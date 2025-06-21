document.addEventListener('DOMContentLoaded', function () {
  // 获取表单和相关元素
  const form = document.getElementById('docker-build-form');
  const dockerfileSourceRepo = document.getElementById('dockerfile-source-repo');
  const dockerfileSourceUpload = document.getElementById('dockerfile-source-upload');
  const repoDockerfileSection = document.getElementById('repo-dockerfile-section');
  const uploadDockerfileSection = document.getElementById('upload-dockerfile-section');
  const buildStatus = document.getElementById('build-status');
  const buildLinkContainer = document.getElementById('build-link-container');
  const buildLink = document.getElementById('build-link');
  const saveConfigCheckbox = document.getElementById('save-config');

  // 在页面加载时恢复保存的配置
  restoreFormConfig();

  // 切换Dockerfile来源选项
  dockerfileSourceRepo.addEventListener('change', function () {
    if (this.checked) {
      repoDockerfileSection.classList.remove('d-none');
      uploadDockerfileSection.classList.add('d-none');
    }
  });

  dockerfileSourceUpload.addEventListener('change', function () {
    if (this.checked) {
      repoDockerfileSection.classList.add('d-none');
      uploadDockerfileSection.classList.remove('d-none');
    }
  });

  // 表单提交处理
  form.addEventListener('submit', function (event) {
    event.preventDefault();

    // 显示加载状态
    updateBuildStatus('info', '正在验证和准备提交构建请求...');

    // 收集表单基础数据
    const formData = {
      repo_url: document.getElementById('repo-url').value,
      repo_branch: document.getElementById('repo-branch').value,
      repo_token: document.getElementById('repo-token').value,
      github_token: document.getElementById('github-token').value,
      dockerfile_source: document.querySelector('input[name="dockerfile-source"]:checked').value,
      dockerfile_path: document.getElementById('dockerfile-path').value,
      docker_registry: document.getElementById('docker-registry').value,
      docker_username: document.getElementById('docker-username').value,
      docker_password: document.getElementById('docker-password').value,
      image_name: document.getElementById('image-name').value,
      image_tag: document.getElementById('image-tag').value
    };

    // 验证必填字段
    if (!validateForm(formData)) {
      updateBuildStatus('danger', '表单验证失败，请检查所有必填字段');
      return;
    }

    // 如果选择了上传Dockerfile，检查是否选择了文件
    if (formData.dockerfile_source === 'upload') {
      const fileInput = document.getElementById('dockerfile-upload');
      if (fileInput.files.length === 0) {
        updateBuildStatus('danger', '请选择要上传的Dockerfile文件');
        return;
      }
    }

    // 保存配置到本地存储（不包含敏感信息）
    if (saveConfigCheckbox.checked) {
      saveFormConfig(formData);
    }

    // 转换为GitHub Actions工作流需要的JSON格式参数
    const workflowInputs = convertToWorkflowInputs(formData);

    // 触发GitHub Actions工作流
    triggerGitHubWorkflow(formData, workflowInputs);
  });

  // 将表单数据转换为GitHub Actions工作流需要的JSON格式参数
  function convertToWorkflowInputs(formData) {
    return {
      // 代码仓库配置 (JSON格式)
      repo_config: JSON.stringify({
        url: formData.repo_url,
        branch: formData.repo_branch,
        token: formData.repo_token
      }),

      // Dockerfile配置 (JSON格式)
      dockerfile_config: JSON.stringify({
        source: formData.dockerfile_source,
        path: formData.dockerfile_path
      }),

      // Docker仓库地址 (单独参数)
      docker_registry: formData.docker_registry,

      // Docker认证信息 (JSON格式)
      docker_auth: JSON.stringify({
        username: formData.docker_username,
        password: formData.docker_password
      }),

      // 镜像配置 (JSON格式)
      image_config: JSON.stringify({
        name: formData.image_name,
        tag: formData.image_tag
      }),

      // GitHub Token (单独参数)
      github_token: formData.github_token
    };
  }

  // 验证表单数据
  function validateForm(formData) {
    // 检查必填字段
    const requiredFields = ['repo_url', 'repo_branch', 'docker_registry', 'docker_username', 'docker_password', 'image_name', 'image_tag'];
    for (const field of requiredFields) {
      if (!formData[field]) {
        return false;
      }
    }

    // 如果选择从仓库使用Dockerfile，则需要dockerfile_path
    if (formData.dockerfile_source === 'repo' && !formData.dockerfile_path) {
      return false;
    }

    return true;
  }

  // 保存表单配置到localStorage（不包含敏感信息）
  function saveFormConfig(formData) {
    const configToSave = {
      repo_url: formData.repo_url,
      repo_branch: formData.repo_branch,
      dockerfile_source: formData.dockerfile_source,
      dockerfile_path: formData.dockerfile_path,
      docker_registry: formData.docker_registry,
      docker_username: formData.docker_username,
      image_name: formData.image_name,
      image_tag: formData.image_tag
    };

    localStorage.setItem('budiu_builder_config', JSON.stringify(configToSave));
  }

  // 从localStorage恢复表单配置
  function restoreFormConfig() {
    const savedConfig = localStorage.getItem('budiu_builder_config');
    if (!savedConfig) return;

    try {
      const config = JSON.parse(savedConfig);

      // 恢复表单值
      if (config.repo_url) document.getElementById('repo-url').value = config.repo_url;
      if (config.repo_branch) document.getElementById('repo-branch').value = config.repo_branch;
      if (config.dockerfile_path) document.getElementById('dockerfile-path').value = config.dockerfile_path;
      if (config.docker_registry) document.getElementById('docker-registry').value = config.docker_registry;
      if (config.docker_username) document.getElementById('docker-username').value = config.docker_username;
      if (config.image_name) document.getElementById('image-name').value = config.image_name;
      if (config.image_tag) document.getElementById('image-tag').value = config.image_tag;

      // 恢复Dockerfile来源选择
      if (config.dockerfile_source === 'upload') {
        document.getElementById('dockerfile-source-upload').checked = true;
        repoDockerfileSection.classList.add('d-none');
        uploadDockerfileSection.classList.remove('d-none');
      } else {
        document.getElementById('dockerfile-source-repo').checked = true;
      }
    } catch (error) {
      console.error('恢复配置时出错:', error);
    }
  }

  // 更新构建状态显示
  function updateBuildStatus(type, message) {
    buildStatus.className = `alert alert-${type} text-center`;
    buildStatus.innerHTML = `<p class="mb-0">${message}</p>`;
  }

  // 模拟触发GitHub Actions工作流
  function triggerGitHubWorkflow(formData, workflowInputs) {
    // 在实际应用中，这里会使用GitHub REST API调用workflow_dispatch事件
    // 为了演示，我们模拟API调用过程

    updateBuildStatus('warning', '<i class="bi bi-hourglass-split me-2"></i>正在提交构建请求到GitHub Actions...');

    // 添加关于GitHub Token的状态消息
    if (formData.github_token) {
      updateBuildStatus('warning', '<i class="bi bi-hourglass-split me-2"></i>正在提交构建请求到GitHub Actions... (已提供GitHub Token，将自动授权构建)');
    } else {
      updateBuildStatus('warning', '<i class="bi bi-hourglass-split me-2"></i>正在提交构建请求到GitHub Actions... (未提供GitHub Token，可能需要手动批准构建)');
    }

    // 模拟API响应延迟
    setTimeout(function () {
      // 模拟成功响应
      const workflowRunId = Math.floor(Math.random() * 9000000) + 1000000; // 生成随机ID
      const repoOwner = 'your-username'; // 替换为实际的GitHub用户名
      const repoName = 'Budiu-Builder'; // 替换为实际的仓库名

      updateBuildStatus('success', `<i class="bi bi-check-circle-fill me-2"></i>构建请求已成功提交! <br>工作流ID: ${workflowRunId}`);

      // 显示GitHub Actions链接
      const actionUrl = `https://github.com/${repoOwner}/${repoName}/actions/runs/${workflowRunId}`;
      buildLink.href = actionUrl;
      buildLinkContainer.classList.remove('d-none');

      // 实际提交逻辑说明
      console.log('在实际应用中，这里会调用GitHub REST API:', {
        endpoint: `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/docker-build.yml/dispatches`,
        method: 'POST',
        payload: {
          ref: 'main',
          inputs: workflowInputs
        }
      });
    }, 1500);
  }
}); 