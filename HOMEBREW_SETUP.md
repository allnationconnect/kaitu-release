# Homebrew 发布配置指南

这个文档解释如何设置 GitHub Actions 来自动发布应用到 Homebrew Tap。

通过 Homebrew Tap，用户可以：
1. 添加你的 tap：`brew tap username/tap-name`
2. 安装应用：`brew install kaitu`

## 前置要求

1. **创建 Homebrew Tap 仓库**
   - 在 GitHub 上创建一个新仓库，命名格式：`homebrew-<tap-name>`
   - 例如：`homebrew-kaitu` 或 `homebrew-tools`
   - 仓库应该是公开的，这样用户才能通过 `brew tap` 安装

2. **生成 GitHub Personal Access Token**
   - 前往 GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
   - 点击 "Generate new token (classic)"
   - 选择权限：
     - `repo` (完整的仓库权限)
     - `write:packages` (如果需要)
   - 复制生成的 token

## 配置 GitHub Secrets

在当前仓库的 Settings > Secrets and variables > Actions 中添加以下 secrets：

### 必需的 Secrets

1. **HOMEBREW_TAP_TOKEN**
   - 值：上面生成的 GitHub Personal Access Token
   - 用途：推送 formula 到 Homebrew tap 仓库

2. **HOMEBREW_TAP_REPO**
   - 值：你的 Homebrew tap 仓库名称（格式：`username/homebrew-tapname`）
   - 示例：`allnationconnect/homebrew-kaitu`
   - 用途：指定要更新的 tap 仓库

### 可选的 Secrets

如果你使用私有仓库存储构建产物，可能需要：

3. **GH_PAT_TOKEN** (如果与现有的发布流程一致)
   - 值：具有读取 releases 权限的 GitHub token

## 工作流程说明

### GitHub Actions

**homebrew-release.yml** - 自动发布到 Homebrew Tap

### 触发方式

1. **自动触发**：推送版本标签时（格式：`v*`，如 `v1.0.0`）
2. **手动触发**：通过 GitHub Actions 界面手动运行，需要指定版本号

### 处理流程

1. 从 GitHub Release 下载构建产物（tar.gz 文件）
2. 计算文件的 SHA256 校验和
3. 生成 Homebrew formula（Ruby 配置文件）
4. 推送 formula 到指定的 Homebrew tap 仓库
5. 创建版本标签

### 生成的 Formula

工作流会自动生成 `kaitu.rb` formula 文件，包含：
- 应用描述和主页链接
- 下载 URL 和 SHA256 校验和
- 安装脚本（可根据应用结构调整）
- 基本测试

## 用户安装方式

配置完成后，用户可以通过以下方式安装：

```bash
# 添加你的 tap
brew tap username/tapname

# 安装应用
brew install kaitu
```

或者直接：

```bash
brew install username/tapname/kaitu
```

## 自定义配置

### 调整 Formula 安装逻辑

如需修改安装逻辑，请编辑 `.github/workflows/homebrew-release.yml` 中的 formula 生成部分：

```ruby
def install
  # 根据你的应用结构调整这些路径
  bin.install "kaitu"                    # 安装二进制文件
  lib.install Dir["lib/*"]               # 安装库文件
  share.install Dir["share/*"]           # 安装共享文件
end
```

### 支持多平台

如果需要支持不同平台（Intel/ARM Mac），可以在 formula 中添加平台特定的逻辑：

```ruby
if Hardware::CPU.arm?
  url "https://github.com/user/repo/releases/download/v#{version}/app-arm64.tar.gz"
  sha256 "arm64_sha256_here"
else
  url "https://github.com/user/repo/releases/download/v#{version}/app-x64.tar.gz"  
  sha256 "x64_sha256_here"
end
```

## 故障排除

### 常见问题

1. **权限错误**
   - 检查 HOMEBREW_TAP_TOKEN 是否有正确的权限
   - 确保 token 没有过期

2. **找不到构建产物**
   - 确保发布流程生成了 tar.gz 文件
   - 检查文件命名是否符合预期

3. **Formula 安装失败**
   - 检查 tar.gz 文件的内部结构
   - 调整 formula 中的安装路径

### 调试步骤

1. 查看 GitHub Actions 日志获取详细错误信息
2. 检查生成的 formula 文件（在 artifacts 中）
3. 在本地测试 formula：`brew install --build-from-source ./kaitu.rb`

## 示例仓库结构

```
homebrew-kaitu/
├── Formula/
│   └── kaitu.rb
└── README.md
```

## 你需要完成的操作

要让 Homebrew Tap 工作，你需要完成以下步骤：

### 1. 创建 Homebrew Tap 仓库

1. 在 GitHub 上创建新的公开仓库
2. 仓库名称：`homebrew-kaitu`（或者 `homebrew-tools`）
3. 初始化仓库，添加 README.md

### 2. 生成 GitHub Personal Access Token

1. 前往 GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. 点击 "Generate new token (classic)"
3. 选择权限：`repo`（完整的仓库权限）
4. 复制生成的 token

### 3. 配置 GitHub Secrets

在当前仓库 Settings > Secrets and variables > Actions 中添加：

1. **HOMEBREW_TAP_TOKEN**
   - 值：刚才生成的 GitHub Personal Access Token

2. **HOMEBREW_TAP_REPO**
   - 值：你的 Homebrew tap 仓库名称
   - 格式：`用户名/homebrew-kaitu`
   - 例如：`allnationconnect/homebrew-kaitu`

### 4. 测试发布

1. 确保你的项目有构建产物（tar.gz 文件）
2. 推送一个版本标签测试：
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
3. 查看 GitHub Actions 执行情况

### 5. 验证安装

配置完成后，用户将能够通过以下方式安装：

```bash
# 添加你的 tap
brew tap allnationconnect/kaitu

# 安装应用
brew install kaitu
```

## 更新流程

每次发布新版本时：
1. 推送新的版本标签到主仓库
2. GitHub Actions 自动更新 Homebrew formula
3. 用户可以通过 `brew upgrade kaitu` 获取最新版本