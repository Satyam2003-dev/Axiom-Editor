# Axiom Editor

An open-source, privacy-minded AI code editor built on Code - OSS. Axiom Editor continues the useful ideas from the discontinued Void project under a new identity, an in-repository Windows release pipeline, and a contributor-friendly workflow.

![Axiom Editor logo](./resources/branding/axiom-master.png)

## Download for Windows

- Stable builds: [GitHub Releases](https://github.com/Satyam2003-dev/Axiom-Editor/releases)
- Development builds: open the latest successful [Windows Build](https://github.com/Satyam2003-dev/Axiom-Editor/actions/workflows/windows-build.yml) run and download the artifact

Releases contain a Windows x64 user installer and a portable ZIP. Published builds are currently unsigned, so Windows SmartScreen may show a warning. Verify that the download came from this repository before running it.

## Highlights

- Agent, chat, quick-edit, and autocomplete workflows inside the editor
- Local Model Center with Ollama and LM Studio detection, catalog downloads, GGUF URL imports, progress, and cancellation
- Bring your own OpenAI-compatible server, including vLLM and other local or remote runtimes
- Streaming diffs with accept/reject controls
- Model Context Protocol (MCP) tool support
- Direct provider requests; Axiom Editor does not operate a proxy that retains prompts
- Open development and reproducible GitHub Actions builds
- Linux x64 remote server artifacts for WSL and Remote SSH workflows

## Quick start from source

Prerequisites: Node.js `20.18.2`, Python, Git, and the platform build tools described in [HOW_TO_CONTRIBUTE.md](./HOW_TO_CONTRIBUTE.md).

```powershell
git clone https://github.com/Satyam2003-dev/Axiom-Editor.git
cd Axiom-Editor
npm ci
npm run buildreact
npm run compile
./scripts/code.bat
```

Use `npm run watch` instead of `npm run compile` while developing.

## Local models

Open **Settings → Models → Local Model Center**. Axiom detects Ollama and LM Studio servers at the endpoints configured under **Local Providers**, lists installed models, and makes completed downloads available to Chat, Apply, Ctrl+K, SCM, and Autocomplete through the existing model selectors.

- **Ollama:** pull a registry model such as `qwen2.5-coder:7b` through the Ollama API.
- **LM Studio:** download an exact GGUF or MLX result through `lms get`; include a quantization such as `@q4_k_m` to avoid an interactive choice. Use **Load (max GPU)** when LM Studio's JIT model loading is disabled.
- **Any GGUF:** provide a direct HTTP(S) `.gguf` URL and a model name. Axiom downloads it into its managed user-data model directory and imports it using the selected local runtime.

Install and start [Ollama](https://ollama.com/download) or open [LM Studio](https://lmstudio.ai/) once before using its CLI. MLX is offered only on Apple Silicon. On Windows and Linux, the runtime normally chooses CUDA when an NVIDIA GPU is available; Linux may instead use ROCm, Vulkan, or CPU depending on the installed hardware and runtime.

## Contributing

Issues and pull requests are welcome. Start with the [contribution guide](./HOW_TO_CONTRIBUTE.md), then use the [codebase guide](./AXIOM_CODEBASE_GUIDE.md) to find the relevant services and UI packages. The project uses the [Contributor Covenant](./CODE_OF_CONDUCT.md).

## Project status

Axiom Editor is an early community continuation. Back up important work, expect changes between releases, and never paste secrets into a model you do not trust. API keys are stored through the editor's configured storage mechanism, but provider privacy and retention policies still apply to requests sent to those providers.

## License and attribution

Axiom Editor's inherited Void additions are licensed under Apache License 2.0; Code - OSS portions remain under the MIT License. See [LICENSE.txt](./LICENSE.txt), [LICENSE-VS-Code.txt](./LICENSE-VS-Code.txt), and [ThirdPartyNotices.txt](./ThirdPartyNotices.txt).

This project is derived from [Void](https://github.com/voideditor/void), which is itself a fork of [Code - OSS](https://github.com/microsoft/vscode). Axiom Editor is not affiliated with Microsoft or the former Void maintainers.
