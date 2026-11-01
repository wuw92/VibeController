# Contributing / 参与贡献

Thank you for helping improve VibeController. Bug reports with reproducible controller, connection, Windows, and Codex details are especially useful.

感谢你帮助改进 VibeController。反馈问题时，请尽量提供可复现步骤、手柄型号与固件、连接方式、Windows 版本和 Codex 版本。

## Development setup / 开发环境

- Windows 10/11 x64
- .NET SDK 8.0.423 (or a compatible patch selected by `global.json`)
- Node.js 20+ and npm
- Microsoft Edge WebView2 Runtime

```powershell
npm ci --prefix frontend
powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
```

The scripts use `.tools\dotnet\dotnet.exe` when available and otherwise use the system `dotnet` command.

## Architecture / 架构

- `src/VibeController.Core`: normalized input, mappings, dispatch, and runtime policy; no Windows device APIs.
- `src/VibeController.Infrastructure`: XInput/DualSense adapters, settings, Codex shortcut resolution, and Windows input/window APIs.
- `src/VibeController.App`: WPF/WebView2 host and application lifecycle.
- `frontend`: React/TypeScript user interface.
- `tests`: unit and integration-style tests for the core and Windows infrastructure boundaries.

Keep device adapters separate from mappings and output injection. A new controller should emit normalized `ControllerControl` events rather than directly sending keys.

设备适配层、映射层和输入注入层必须保持分离。新增设备应输出统一的 `ControllerControl` 事件，不要在设备适配器中直接发送键盘或鼠标操作。

### Runtime bridge

- Input processing remains on a 16 ms timer. Mapping edits/reset update the existing runtime profile; only device/backend changes rebuild the adapter.
- Version 1 `runtimeState` keeps its existing envelope. Input-only payloads omit `configuration`; configuration changes are coalesced to at most one publication every 250 ms. `requestState` and `CurrentStateJson` provide a self-contained replay with configuration.
- Consumers merge partial configuration fields, retaining configuration when omitted or `null`. A supplied `mappings` dictionary is a **complete profile snapshot**, including reset results, not a dictionary patch. Controls likewise represent the latest snapshot.
- React coalesces host messages to one update per animation frame. Backend `DefaultProfileFactory` is authoritative for mapping defaults; the editor waits for host configuration and waits for the host's reset response. The dashboard displays current host mappings rather than a second default table.
- `npm run dev --prefix frontend` without a WebView host displays a disconnected/loading workspace. Add `?demo` to explicitly preview controller feedback; mapping editing remains disabled until host configuration arrives.
- Configuration formatting and raw-input learning lifecycle helpers live in service partials. Learning save/rollback stays in the service's existing settings-write/runtime-gate orchestration so extraction does not alter cancellation or stale-session handling.

## Pull requests / Pull Request 要求

1. Explain the user-visible problem and intended behavior.
2. Add or update tests for behavior changes.
3. Run the complete test script and `git diff --check`.
4. For UI changes, attach before/after screenshots and respect reduced-motion behavior.
5. For device support, complete relevant parts of `docs/testing/hardware-checklist.md` and state what was tested on real hardware.
6. Keep commits focused; never include `artifacts`, `node_modules`, `.tools`, logs, personal paths, or credentials.

提交前请说明用户问题与预期行为、补充测试、运行完整验证；涉及 UI 时提供截图，涉及设备兼容时说明实体硬件与连接方式。不要提交构建产物、本地工具链、日志、个人路径或凭据。

By contributing, you agree that your contribution may be distributed under the repository's MIT License. Controller product images require separate rights clearance as described in `THIRD_PARTY_NOTICES.md`.
