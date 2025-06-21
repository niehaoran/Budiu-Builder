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
  const platformsSelect = document.getElementById('platforms-select');

  // GitHub配置
  const GITHUB_OWNER = 'niehaoran'; // 替换为实际的GitHub用户名
  const GITHUB_REPO = 'Budiu-Builder'; // 替换为实际的仓库名
  const GITHUB_WORKFLOW_FILE = 'docker-build.yml'; // 工作流文件名

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
      image_tag: document.getElementById('image-tag').value,
      platforms: getSelectedPlatforms()
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

      // 这里处理Dockerfile上传的逻辑
      // 实际应用中需要先上传Dockerfile到服务器，然后再触发工作流
      // 为了简化示例，这里假设已经处理了上传
    }

    // 保存配置到本地存储（不包含敏感信息）
    if (saveConfigCheckbox.checked) {
      saveFormConfig(formData);
    }

    // 转换为GitHub Actions工作流需要的单一JSON格式参数
    const workflowInputs = {
      config: JSON.stringify({
        repo: {
          url: formData.repo_url,
          branch: formData.repo_branch,
          token: formData.repo_token
        },
        dockerfile: {
          source: formData.dockerfile_source,
          path: formData.dockerfile_path
        },
        docker: {
          registry: formData.docker_registry,
          username: formData.docker_username,
          password: formData.docker_password
        },
        image: {
          name: formData.image_name,
          tag: formData.image_tag,
          platforms: formData.platforms
        }
      }),
      github_token: formData.github_token
    };

    // 实际触发GitHub Actions工作流
    triggerGitHubWorkflow(formData, workflowInputs);
  });

  // 获取选中的平台列表
  function getSelectedPlatforms() {
    // 获取所有选中的平台复选框
    const checkboxes = document.querySelectorAll('input[name="platforms"]:checked');
    if (checkboxes.length === 0) {
      return 'linux/amd64'; // 默认值
    }

    // 将选中的值合并为逗号分隔的字符串
    return Array.from(checkboxes).map(checkbox => checkbox.value).join(',');
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
      image_tag: formData.image_tag,
      platforms: formData.platforms
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

      // 恢复平台选择
      if (config.platforms) {
        const platforms = config.platforms.split(',');
        platforms.forEach(platform => {
          const checkbox = document.querySelector(`input[name="platforms"][value="${platform}"]`);
          if (checkbox) checkbox.checked = true;
        });
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

  // 实际触发GitHub Actions工作流
  function triggerGitHubWorkflow(formData, workflowInputs) {
    // 检查是否提供了GitHub Token
    if (!formData.github_token) {
      updateBuildStatus('warning', '<i class="bi bi-exclamation-triangle-fill me-2"></i>未提供GitHub Token，无法自动触发工作流。请提供GitHub Token后重试。');
      return;
    }

    updateBuildStatus('warning', '<i class="bi bi-hourglass-split me-2"></i>正在提交构建请求到GitHub Actions...');

    // 构建API请求参数
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW_FILE}/dispatches`;

    // 发送请求到GitHub API
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Authorization': `token ${formData.github_token}`
      },
      body: JSON.stringify({
        ref: 'main',  // 指定要在其上运行工作流的分支
        inputs: workflowInputs
      })
    })
      .then(response => {
        if (response.ok || response.status === 204) {
          // GitHub API在成功时返回204 No Content
          // 由于GitHub API不返回工作流运行ID，我们需要重定向到GitHub Actions页面
          const actionsUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions`;

          updateBuildStatus('success', `<i class="bi bi-check-circle-fill me-2"></i>构建请求已成功提交! <br>请查看GitHub Actions页面获取详情。`);

          // 显示GitHub Actions链接
          buildLink.href = actionsUrl;
          buildLink.textContent = '查看GitHub Actions构建详情';
          buildLinkContainer.classList.remove('d-none');
        } else {
          throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
      })
      .catch(error => {
        console.error('触发工作流时出错:', error);
        updateBuildStatus('danger', `<i class="bi bi-x-circle-fill me-2"></i>触发工作流失败: ${error.message}`);
      });
  }
}); 