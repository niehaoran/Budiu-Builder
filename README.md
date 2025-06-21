# Budiu Docker 构建器

一个基于GitHub Actions的Docker镜像自动构建工具，可通过网页界面轻松触发构建流程。

## 功能特点

- 🚀 通过网页界面触发Docker镜像构建
- 🔄 支持任意代码仓库（GitHub/Gitee等）
- 🔒 支持私有仓库（通过访问令牌）
- 📄 灵活选择Dockerfile来源（仓库内或上传）
- 📦 支持推送到任意Docker镜像仓库
- 💾 保存构建配置到本地（不含敏感信息）
- 🔍 实时查看构建状态和结果
- 🔑 支持自动授权构建（无需手动批准）

## 快速开始

1. Fork或克隆此仓库到您的GitHub账户
2. 启用GitHub Pages（设置为从`main`分支的`/docs`目录发布）
3. 访问您的GitHub Pages网址（通常为`https://[用户名].github.io/Budiu-Builder/`）
4. 使用网页界面配置构建参数并触发构建

## 工作流配置参数

构建工作流接受以下参数：

| 参数名 | 描述 | 是否必须 |
|-------|------|---------|
| `repo_url` | 代码仓库地址 (GitHub/Gitee等) | 是 |
| `repo_branch` | 代码仓库分支 | 是，默认`main` |
| `repo_token` | 私有仓库访问令牌 | 否 |
| `github_token` | GitHub个人访问令牌（用于自动授权构建） | 否，但建议提供 |
| `dockerfile_source` | Dockerfile来源 (`repo`或`upload`) | 是，默认`repo` |
| `dockerfile_path` | 仓库中的Dockerfile路径 | 在`dockerfile_source=repo`时必须 |
| `docker_registry` | Docker镜像仓库地址 | 是 |
| `docker_auth` | Docker认证信息 (格式: 用户名:密码) | 是 |
| `image_info` | Docker镜像信息 (格式: 名称:标签) | 是，不含标签时默认使用`latest` |

## 自动授权构建

为了避免每次构建都需要手动批准，您可以：

1. 创建GitHub个人访问令牌(PAT)：
   - 在GitHub账户设置中，进入`Settings` > `Developer settings` > `Personal access tokens` > `Generate new token`
   - 勾选权限：至少需要`repo`和`workflow`权限
   - 生成并保存令牌

2. 在构建表单中提供此令牌：
   - 在表单的`GitHub Token`字段中输入您创建的个人访问令牌
   - 这样可以跳过手动审批步骤，直接执行构建

## 实现原理

1. 用户通过网页界面填写构建参数
2. 表单提交触发GitHub Actions `workflow_dispatch`事件
3. 如果提供了GitHub Token，将自动授权构建无需等待批准
4. GitHub Actions工作流执行以下步骤：
   - 克隆指定的代码仓库
   - 准备Dockerfile（从仓库或上传的文件）
   - 登录到指定的Docker镜像仓库
   - 构建并推送Docker镜像
   - 返回构建结果

## 本地开发

如果您想在本地开发或修改此项目，可以按照以下步骤进行：

```bash
# 克隆仓库
git clone https://github.com/your-username/Budiu-Builder.git
cd Budiu-Builder

# 安装依赖（如果有需要）
# npm install

# 在本地测试网页
cd docs
python -m http.server 8000
# 访问 http://localhost:8000
```

## 贡献指南

欢迎通过以下方式为此项目做出贡献：

1. Fork仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 许可证

此项目采用MIT许可证 - 详情请查看 [LICENSE](LICENSE) 文件。

## 免责声明

本工具仅用于简化Docker镜像的构建过程，用户应当确保使用的所有代码和镜像符合相关的许可和规定。使用此工具构建的Docker镜像的内容和用途由用户自行负责。

## 安全提示

- 请勿在公共场所分享您的GitHub个人访问令牌或Docker仓库凭据
- 建议为此工具创建范围有限的GitHub Token，只授予必要的权限
- 定期轮换您的访问令牌和密码 