# Diagnostics Collector 模版

> 上级规则：`docs/rules/rn/diagnostics.md`、`docs/rules/rn/observability.md`。

## 适用场景

用户主动反馈问题时，收集本地日志 + breadcrumb + device info 并上传到后端的统一模块。

## 模块结构

```
src/domain/diagnostics/
  log-file.ts            # JSONL 日志文件读写 + rotation
  breadcrumbs.ts         # 内存环形 buffer
  device-info.ts         # 收集设备信息
  diagnostics-store.ts   # zustand：state + 上传状态
  upload.ts              # 调 endpoint 上传
  types.ts
src/api/endpoints/
  diagnostics.ts         # 上传 endpoint wrapper
```

## log-file.ts

```ts
// src/domain/diagnostics/log-file.ts
import * as FileSystem from 'expo-file-system';

const LOG_DIR = `${FileSystem.documentDirectory}diagnostics/`;
const LOG_FILE = `${LOG_DIR}app.log`;
const LOG_FILE_ROTATED = (n: number) => `${LOG_DIR}app.log.${n}`;
const MAX_FILE_SIZE = 1024 * 1024; // 1 MB
const MAX_ROTATED = 2; // 保留 app.log.1 + app.log.2

interface ILogEntry {
  ts: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  payload?: unknown;
}

let pendingBuffer: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 5000;
const FLUSH_BATCH_SIZE = 50;

/**
 * 添加一条日志到 buffer。buffer 满或定时器触发后 flush 到文件。
 *
 * 调用方必须保证 entry.payload 已经过 redaction。
 */
export function enqueueLog(entry: ILogEntry): void {
  pendingBuffer.push(JSON.stringify(entry));

  // error 级别立即 flush，避免崩溃前丢日志
  if (entry.level === 'error' || pendingBuffer.length >= FLUSH_BATCH_SIZE) {
    void flushLogs();
    return;
  }

  if (!flushTimer) {
    flushTimer = setTimeout(() => void flushLogs(), FLUSH_INTERVAL_MS);
  }
}

/**
 * 强制 flush buffer 到文件。
 */
export async function flushLogs(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pendingBuffer.length === 0) return;

  const lines = pendingBuffer.join('\n') + '\n';
  pendingBuffer = [];

  try {
    await ensureLogDirExists();
    await rotateIfNeeded();
    await appendToFile(LOG_FILE, lines);
  } catch {
    // 静默：磁盘失败不能影响业务
  }
}

async function ensureLogDirExists(): Promise<void> {
  const info = await FileSystem.getInfoAsync(LOG_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(LOG_DIR, { intermediates: true });
  }
}

async function rotateIfNeeded(): Promise<void> {
  const info = await FileSystem.getInfoAsync(LOG_FILE);
  if (!info.exists || (info.size ?? 0) < MAX_FILE_SIZE) return;

  // 删除最老
  const oldest = LOG_FILE_ROTATED(MAX_ROTATED);
  const oldestInfo = await FileSystem.getInfoAsync(oldest);
  if (oldestInfo.exists) {
    await FileSystem.deleteAsync(oldest);
  }
  // 依次向后移
  for (let i = MAX_ROTATED - 1; i >= 1; i -= 1) {
    const from = LOG_FILE_ROTATED(i);
    const to = LOG_FILE_ROTATED(i + 1);
    const fromInfo = await FileSystem.getInfoAsync(from);
    if (fromInfo.exists) {
      await FileSystem.moveAsync({ from, to });
    }
  }
  // 当前文件 → .1
  await FileSystem.moveAsync({ from: LOG_FILE, to: LOG_FILE_ROTATED(1) });
}

async function appendToFile(path: string, content: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.writeAsStringAsync(path, content);
    return;
  }
  const existing = await FileSystem.readAsStringAsync(path);
  await FileSystem.writeAsStringAsync(path, existing + content);
}

/**
 * 读取所有日志文件供上传使用。返回 { path, content } 数组。
 */
export async function readAllLogFiles(): Promise<Array<{ name: string; uri: string }>> {
  await flushLogs();
  const files: Array<{ name: string; uri: string }> = [];

  for (const [name, uri] of [
    ['app.log', LOG_FILE],
    ['app.log.1', LOG_FILE_ROTATED(1)],
    ['app.log.2', LOG_FILE_ROTATED(2)],
  ] as const) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) files.push({ name, uri });
  }

  return files;
}

/**
 * 清空所有本地日志文件（用户上传后选择"清空"时调用）。
 */
export async function clearAllLogs(): Promise<void> {
  pendingBuffer = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const info = await FileSystem.getInfoAsync(LOG_DIR);
  if (info.exists) {
    await FileSystem.deleteAsync(LOG_DIR, { idempotent: true });
  }
}
```

## breadcrumbs.ts

```ts
// src/domain/diagnostics/breadcrumbs.ts

export type BreadcrumbType = 'nav' | 'api' | 'action' | 'error' | 'lifecycle';

export interface IBreadcrumb {
  ts: string;
  type: BreadcrumbType;
  payload: Record<string, unknown>;
}

const MAX_BREADCRUMBS = 100;
const buffer: IBreadcrumb[] = [];

/**
 * 追加一条 breadcrumb；超过容量时丢弃最早的一条。
 */
export function pushBreadcrumb(type: BreadcrumbType, payload: Record<string, unknown>): void {
  buffer.push({
    ts: new Date().toISOString(),
    type,
    payload,
  });
  if (buffer.length > MAX_BREADCRUMBS) {
    buffer.shift();
  }
}

/**
 * 读取当前 breadcrumb 快照供上传使用。
 */
export function getBreadcrumbsSnapshot(): IBreadcrumb[] {
  return buffer.slice();
}

/**
 * 清空（一般不主动调用；应用关闭即清空）。
 */
export function clearBreadcrumbs(): void {
  buffer.length = 0;
}
```

## device-info.ts

```ts
// src/domain/diagnostics/device-info.ts
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Localization from 'expo-localization';
import { Platform } from 'react-native';

import { useNetworkStore } from '@domain/network/network-store';

export interface IDeviceInfo {
  platform: 'ios' | 'android' | 'web';
  osVersion: string;
  deviceModel: string;
  appVersion: string;
  buildNumber: string;
  bundleId: string;
  locale: string;
  timezone: string;
  isConnected: boolean;
  networkType: string;
}

/**
 * 收集当前设备与应用信息。
 */
export async function collectDeviceInfo(): Promise<IDeviceInfo> {
  const network = useNetworkStore.getState();
  const locales = Localization.getLocales();
  const timezone = Localization.getCalendars()[0]?.timeZone ?? 'UTC';

  return {
    platform: Platform.OS as 'ios' | 'android' | 'web',
    osVersion: String(Platform.Version),
    deviceModel: Device.modelName ?? 'unknown',
    appVersion: Application.nativeApplicationVersion ?? '0.0.0',
    buildNumber: Application.nativeBuildVersion ?? '0',
    bundleId: Application.applicationId ?? 'unknown',
    locale: locales[0]?.languageTag ?? 'en',
    timezone,
    isConnected: network.isConnected,
    networkType: network.type,
  };
}
```

## diagnostics-store.ts

```ts
// src/domain/diagnostics/diagnostics-store.ts
import { create } from 'zustand';

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface IDiagnosticsStoreState {
  uploadStatus: UploadStatus;
  lastTicketId: string | null;
  setUploadStatus: (status: UploadStatus) => void;
  setLastTicketId: (ticketId: string | null) => void;
}

export const useDiagnosticsStore = create<IDiagnosticsStoreState>((set) => ({
  uploadStatus: 'idle',
  lastTicketId: null,
  setUploadStatus: (status) => set({ uploadStatus: status }),
  setLastTicketId: (ticketId) => set({ lastTicketId: ticketId }),
}));
```

## upload.ts

```ts
// src/domain/diagnostics/upload.ts
import { uploadDiagnostics } from '@api/endpoints/diagnostics';
import { logger } from '@api/logger';

import { readAllLogFiles, clearAllLogs } from './log-file';
import { getBreadcrumbsSnapshot } from './breadcrumbs';
import { collectDeviceInfo } from './device-info';
import { useDiagnosticsStore } from './diagnostics-store';

interface IUploadDiagnosticsInput {
  description: string;
  contactEmail?: string;
  authToken?: string;
}

/**
 * 收集本地日志 + breadcrumb + device info，调用后端 upload endpoint。
 * 不自动清空本地日志；上传成功后由调用方决定是否清空。
 */
export async function uploadDiagnosticsReport(input: IUploadDiagnosticsInput): Promise<{ ticketId: string }> {
  const store = useDiagnosticsStore.getState();
  store.setUploadStatus('uploading');

  try {
    const [logFiles, deviceInfo] = await Promise.all([readAllLogFiles(), collectDeviceInfo()]);
    const breadcrumbs = getBreadcrumbsSnapshot();

    const result = await uploadDiagnostics(
      {
        description: input.description,
        contactEmail: input.contactEmail,
        deviceInfo,
        breadcrumbs,
        logFiles,
      },
      { authToken: input.authToken },
    );

    store.setUploadStatus('success');
    store.setLastTicketId(result.ticketId);
    return result;
  } catch (error) {
    store.setUploadStatus('error');
    logger.warn('diagnostics_upload_failed', { error });
    throw error;
  }
}

export async function clearDiagnosticsLogs(): Promise<void> {
  await clearAllLogs();
}
```

## endpoint wrapper

```ts
// src/api/endpoints/diagnostics.ts
import * as FileSystem from 'expo-file-system';
import { readApiConfig } from '@api/config';
import { ApiError } from '@api/errors';
import type { ApiHelperOptions } from '@api/client';

interface IUploadInput {
  description: string;
  contactEmail?: string;
  deviceInfo: unknown;
  breadcrumbs: unknown;
  logFiles: Array<{ name: string; uri: string }>;
}

/**
 * 上传诊断信息。使用 expo-file-system 的 uploadAsync 走 multipart。
 */
export async function uploadDiagnostics(
  input: IUploadInput,
  options: ApiHelperOptions = {},
): Promise<{ ticketId: string }> {
  const baseUrl = options.baseUrl ?? readApiConfig().apiBaseUrl;
  const url = `${baseUrl}/api/diagnostics/upload`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.authToken) {
    headers.Authorization = `Bearer ${options.authToken}`;
  }

  // 文本字段通过 parameters；文件通过 multipart fieldName
  // 这里以单个主文件演示；多个文件需要多次上传或扩展 multipart
  const mainFile = input.logFiles[0];
  if (!mainFile) {
    throw new ApiError('No log file available', 0);
  }

  const result = await FileSystem.uploadAsync(url, mainFile.uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'logs',
    headers,
    parameters: {
      description: input.description,
      contactEmail: input.contactEmail ?? '',
      deviceInfo: JSON.stringify(input.deviceInfo),
      breadcrumbs: JSON.stringify(input.breadcrumbs),
      uploadedAt: new Date().toISOString(),
    },
  });

  if (result.status >= 200 && result.status < 300) {
    const parsed = JSON.parse(result.body) as { data: { ticketId: string } };
    return { ticketId: parsed.data.ticketId };
  }

  throw new ApiError(`Diagnostics upload failed: ${result.status}`, result.status, result.body);
}
```

## Logger 集成

在 `@api/logger` 中接入 `enqueueLog`：

```ts
// src/api/logger.ts（节选，详见 docs/rules/rn/templates/logger.md）
import { enqueueLog } from '@domain/diagnostics/log-file';
import { pushBreadcrumb } from '@domain/diagnostics/breadcrumbs';

function emit(level: LogLevel, event: string, payload?: Record<string, unknown>): void {
  const safe = payload ? redactSensitiveFields(payload) : undefined;

  if (__DEV__) {
    // console output 不变
  }

  // 持久化到本地（warn + error 必写；info 可选）
  if (level === 'warn' || level === 'error' || level === 'info') {
    enqueueLog({
      ts: new Date().toISOString(),
      level,
      event,
      payload: safe,
    });
  }

  // 添加到 breadcrumb（仅 error）
  if (level === 'error') {
    pushBreadcrumb('error', { event, payload: safe });
  }

  // 上报 APM reporter（如已注入）
  // ...
}
```

## Breadcrumb 集成点

```ts
// src/api/client.ts 内
import { pushBreadcrumb } from '@domain/diagnostics/breadcrumbs';

const start = Date.now();
const response = await fetchImpl(url, init);
pushBreadcrumb('api', {
  method: options.method,
  url,
  status: response.status,
  durationMs: Date.now() - start,
});
```

```tsx
// app/_layout.tsx 或 navigation listener
const segments = useSegments();
useEffect(() => {
  pushBreadcrumb('nav', { path: '/' + segments.join('/') });
}, [segments]);
```

```ts
// AppState listener
AppState.addEventListener('change', (state) => {
  pushBreadcrumb('lifecycle', { state });
});
```

## Settings 入口

```tsx
// src/components/settings/diagnostics-screen.tsx
function DiagnosticsScreen() {
  const { t } = useTranslation();
  const pushToast = useAppToast();
  const status = useDiagnosticsStore((s) => s.uploadStatus);
  const lastTicket = useDiagnosticsStore((s) => s.lastTicketId);
  const authToken = useSessionStore((s) => s.authToken);

  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');

  async function handleSubmit() {
    if (description.trim().length < 10) {
      pushToast({ title: t('diagnostics.error.descriptionTooShort'), variant: 'warning' });
      return;
    }

    try {
      const result = await uploadDiagnosticsReport({
        description,
        contactEmail: email || undefined,
        authToken: authToken ?? undefined,
      });
      pushToast({
        title: t('diagnostics.success.uploaded', { ticketId: result.ticketId }),
        variant: 'success',
      });
      // TODO: 弹 confirm 询问是否清空本地日志
    } catch {
      pushToast({ title: t('diagnostics.error.uploadFailed'), variant: 'error' });
    }
  }

  return (
    <SubpageScreenFrame title={t('diagnostics.title')}>
      <Text>{t('diagnostics.description')}</Text>
      <Input
        value={description}
        onChangeText={setDescription}
        placeholder={t('diagnostics.field.description.placeholder')}
        multiline
      />
      <Input
        value={email}
        onChangeText={setEmail}
        placeholder={t('diagnostics.field.email.placeholder')}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Button
        label={t('diagnostics.submit')}
        onPress={handleSubmit}
        loading={status === 'uploading'}
        disabled={description.trim().length < 10}
      />
      {lastTicket && <Text>{t('diagnostics.lastTicket', { ticketId: lastTicket })}</Text>}
    </SubpageScreenFrame>
  );
}
```

## 注意点

- **redaction 先于持久化**：`enqueueLog` 调用前 payload 必须已经 redact（logger 内已处理）。
- **buffer 清理时机**：`error` 级别立即 flush；正常路径 5 秒 / 50 条 flush 一次。
- **磁盘失败静默**：不允许诊断写入失败影响业务流程。
- **不自动上传**：必须用户主动 opt-in。
- **上传后清空可选**：默认不清空，避免影响后续问题排查。
- **隐私政策**：上传内容（日志 + breadcrumb + device info）必须在隐私政策中描述。

## 测试

- `log-file.test.ts`：覆盖 rotation、buffer flush、append、空文件处理。
- `breadcrumbs.test.ts`：覆盖环形 buffer 满后丢弃最早。
- `upload.test.ts`：mock `FileSystem.uploadAsync`，覆盖成功 / 4xx / 网络失败。
- 集成测试：`logger.warn` → 验证日志文件含对应 entry。
