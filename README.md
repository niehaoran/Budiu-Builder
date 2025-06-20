# Budiu-Builder

Budiu-Builder是一个基于GitHub Actions的自动构建系统，用于将GitHub/Gitee仓库自动构建为Docker镜像并推送到指定的镜像仓库。

## 功能特点

- 支持GitHub和Gitee代码仓库作为源代码
- 支持公开和私有仓库（通过访问令牌）
- 使用Buildpacks自动识别项目类型并构建Docker镜像
- 支持推送到DockerHub或任意自定义镜像仓库
- 构建完成后可选择性通知后端服务
- 提供用户友好的Web界面，可部署在GitHub Pages上

## 使用方法

### 服务器端设置

1. Fork本仓库
2. 配置GitHub Actions工作流：
   - `.github/workflows/build.yml`文件已包含所有构建逻辑
   - 无需设置仓库级别的Secrets，所有必要信息在构建时由用户提供
3. 部署Web界面：
   - 启用GitHub Pages，选择`/docs`目录作为源
   - 用户可以通过Web界面直接触发构建

### Web界面部署

本项目包含一个用户友好的Web界面，可以轻松部署到GitHub Pages：

1. 在仓库的"Settings"选项卡中，找到"Pages"部分
2. 在"Source"下拉菜单中选择"main branch"和"/docs"文件夹
3. 点击"Save"按钮
4. GitHub会生成一个URL（通常是 `https://{username}.github.io/Budiu-Builder`）
5. 部署完成后，用户可以通过该URL访问Web界面

### 安全性说明

本系统处理敏感信息的方式：

1. **Docker凭据** - 用户输入的凭据直接传递给GitHub Actions，不会在前端存储
2. **仓库令牌** - 用于访问私有仓库的令牌仅在构建过程中使用，不会被保存
3. **GitHub令牌** - 用于触发工作流的令牌仅在API请求中使用，不会被前端存储
4. **本地存储** - 默认仅保存非敏感信息（仓库URL、镜像名称等）

## 使用方式

### Web界面构建流程

1. 访问Web界面（GitHub Pages部署）
2. 填写代码仓库信息（URL和分支）
3. 提供Docker凭据（用于推送镜像）
4. 提供GitHub令牌（用于触发工作流）
5. 可选择性提供回调URL（构建完成通知）
6. 点击提交构建请求

构建触发后，GitHub Actions会自动执行以下步骤：
- 克隆指定的代码仓库
- 使用Buildpacks识别项目类型并构建镜像
- 推送镜像到指定的Docker仓库
- 如果提供了回调URL，则通知指定服务构建完成

## 工作流程

1. 用户通过Web界面提交构建请求
2. Web界面使用GitHub API直接触发GitHub Actions工作流
3. GitHub Actions克隆代码，使用Buildpacks构建镜像
4. GitHub Actions推送镜像到指定的Docker仓库
5. 如果提供了回调URL，GitHub Actions通知指定服务构建完成
6. 用户可以部署和访问构建好的应用

## 所需GitHub令牌权限

使用本系统需要创建具有以下权限的GitHub个人访问令牌：

- `repo` - 完整的仓库访问权限（用于触发工作流）
- `workflow` - 更新GitHub Actions工作流文件的权限

创建令牌的步骤：
1. 访问GitHub设置页面
2. 点击"Developer settings"
3. 选择"Personal access tokens" > "Tokens (classic)"
4. 点击"Generate new token"
5. 选择上述权限并创建令牌

## 配置文件

查看 `.github/workflows/build.yml` 获取工作流配置详情。