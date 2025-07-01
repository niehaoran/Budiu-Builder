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

  // 调试工具相关元素
  const debugGithubToken = document.getElementById('debug-github-token');
  const debugRequestJson = document.getElementById('debug-request-json');
  const sendTestRequest = document.getElementById('send-test-request');
  const debugStatus = document.getElementById('debug-status');

  // GitHub配置
  const GITHUB_OWNER = 'niehaoran'; // 替换为实际的GitHub用户名
  const GITHUB_REPO = 'Budiu-Builder'; // 替换为实际的仓库名
  const GITHUB_WORKFLOW_FILE = 'docker-build.yml'; // 工作流文件名

  // 构建日志相关元素
  const buildLogsContainer = document.getElementById('build-logs-container');
  const buildLogs = document.getElementById('build-logs');
  const refreshLogsBtn = document.getElementById('refresh-logs');
  const toggleAutoscrollBtn = document.getElementById('toggle-autoscroll');
  const buildProgress = document.getElementById('build-progress').querySelector('.progress-bar');
  const buildSteps = document.getElementById('build-steps');

  // 自动滚动标志
  let autoScroll = true;

  // 构建状态数据
  let currentBuildRunId = null;
  let buildStepStatuses = new Map();
  let websocket = null;

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

  // 切换自动滚动
  toggleAutoscrollBtn.addEventListener('click', function () {
    autoScroll = !autoScroll;
    this.classList.toggle('active', autoScroll);
  });

  // 刷新日志
  refreshLogsBtn.addEventListener('click', function () {
    if (currentBuildRunId) {
      fetchBuildLogs(currentBuildRunId);
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

    // 在触发构建之前，准备回调URL
    const callbackUrl = getCallbackUrl();

    // 添加到workflowInputs
    workflowInputs.status_callback_url = callbackUrl;

    // 触发GitHub Actions工作流
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

  // 显示调试信息
  function showDebugInfo(data) {
    const debugContainer = document.createElement('div');
    debugContainer.className = 'debug-info mt-2 p-3 bg-light border rounded';

    const heading = document.createElement('h6');
    heading.className = 'mb-2 text-secondary';
    heading.innerHTML = '<i class="bi bi-bug"></i> 调试信息';
    debugContainer.appendChild(heading);

    const pre = document.createElement('pre');
    pre.className = 'mb-0 small';
    pre.style.maxHeight = '200px';
    pre.style.overflow = 'auto';
    pre.textContent = JSON.stringify(data, null, 2);
    debugContainer.appendChild(pre);

    // 如果已存在调试信息，则替换
    const existingDebug = buildStatus.querySelector('.debug-info');
    if (existingDebug) {
      existingDebug.remove();
    }

    buildStatus.appendChild(debugContainer);
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

    // 严格按照.github/workflows/docker-build.yml文件中定义的输入参数格式构造请求
    // 1. build_config: 'github_repo|github_branch'
    const build_config = `${formData.repo_url}|${formData.repo_branch}`;

    // 2. docker_config: 'registry|username|image_full_name|platforms'
    const image_full_name = `${formData.image_name}:${formData.image_tag}`;
    const docker_config = `${formData.docker_registry}|${formData.docker_username}|${image_full_name}|${formData.platforms}`;

    // 3. extra_config: 'dockerfile_path|user_files_base64'
    const extra_config = `${formData.dockerfile_path}|`;

    // 4. encrypted_secrets: 可选，这里简单用base64编码
    // 实际应用中应使用公钥加密
    const docker_password_encoded = formData.docker_password ? btoa(formData.docker_password) : '';

    // 准备请求数据，用于显示调试信息
    const requestData = {
      url: apiUrl,
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Authorization': 'token ********' // 隐藏真实token
      },
      body: {
        ref: 'main',
        inputs: {
          build_config,
          docker_config,
          extra_config,
          encrypted_secrets: docker_password_encoded ? '******' : '', // 隐藏敏感信息
          status_callback_url: workflowInputs.status_callback_url || ''
        }
      }
    };

    console.log("发送请求到GitHub Actions：", requestData);

    // 显示调试信息
    showDebugInfo(requestData);

    // 发送请求到GitHub API
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Authorization': `token ${formData.github_token}`
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          build_config: build_config,
          docker_config: docker_config,
          extra_config: extra_config,
          encrypted_secrets: docker_password_encoded,
          status_callback_url: workflowInputs.status_callback_url || ''
        }
      })
    })
      .then(response => {
        if (response.ok || response.status === 204) {
          // GitHub API在成功时返回204 No Content
          const actionsUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions`;

          updateBuildStatus('success', `<i class="bi bi-check-circle-fill me-2"></i>构建请求已成功提交! <br>请查看GitHub Actions页面获取详情。`);

          // 显示GitHub Actions链接
          buildLink.href = actionsUrl;
          buildLink.textContent = '查看GitHub Actions构建详情';
          buildLinkContainer.classList.remove('d-none');

          // 启动WebSocket连接并显示构建日志容器
          startBuildMonitoring();
        } else {
          // 如果有错误响应，尝试读取详细信息
          return response.json().then(errorData => {
            console.error("API错误详情:", JSON.stringify(errorData));
            showDebugInfo(errorData);
            throw new Error(`API请求失败: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
          }).catch(err => {
            if (err.message.includes('API请求失败')) {
              throw err;
            } else {
              throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
            }
          });
        }
      })
      .catch(error => {
        console.error('触发工作流时出错:', error);
        updateBuildStatus('danger', `<i class="bi bi-x-circle-fill me-2"></i>触发工作流失败: ${error.message}`);
      });
  }

  // 获取回调URL
  function getCallbackUrl() {
    // 在实际部署时，这应该是您的后端API URL
    // 对于测试，我们可以使用一个公共的请求检查服务
    return 'https://your-backend-api.com/api/build-status';
  }

  // 启动构建监控
  function startBuildMonitoring() {
    // 显示构建日志容器
    buildLogsContainer.classList.remove('d-none');

    // 重置构建状态
    buildStepStatuses.clear();
    buildSteps.innerHTML = '';
    buildProgress.style.width = '0%';
    buildLogs.innerHTML = '<div class="text-center text-muted p-3"><i class="bi bi-hourglass me-2"></i>正在连接到构建服务器...</div>';

    // 创建WebSocket连接
    connectWebSocket();

    // 模拟获取最新的运行ID（在实际应用中，这应该从GitHub API获取）
    setTimeout(() => {
      // 这只是一个模拟，实际应用中应该从GitHub API获取
      currentBuildRunId = 'build-' + Date.now();

      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
          type: 'subscribe',
          runId: currentBuildRunId
        }));
      }

      // 初始化构建步骤
      initBuildSteps();
    }, 1000);
  }

  // 连接WebSocket
  function connectWebSocket() {
    // 关闭现有连接
    if (websocket) {
      websocket.close();
    }

    // 创建新连接
    websocket = new WebSocket('wss://your-websocket-server.com/ws');

    websocket.onopen = function () {
      console.log('WebSocket连接已建立');
      buildLogs.innerHTML = '<div class="text-success">已连接到构建服务器，等待构建开始...</div>';

      // 如果已有构建ID，立即订阅
      if (currentBuildRunId) {
        websocket.send(JSON.stringify({
          type: 'subscribe',
          runId: currentBuildRunId
        }));
      }
    };

    websocket.onmessage = function (event) {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'update' && message.data) {
          handleStatusUpdates(message.data);
        } else if (message.type === 'log' && message.data) {
          appendBuildLog(message.data);
        } else if (message.type === 'init' && message.data) {
          // 处理初始数据
          handleStatusUpdates(message.data);
        }
      } catch (error) {
        console.error('处理WebSocket消息时出错:', error);
      }
    };

    websocket.onerror = function (error) {
      console.error('WebSocket错误:', error);
      buildLogs.innerHTML += '<div class="text-danger">连接错误，无法获取实时构建日志</div>';
    };

    websocket.onclose = function () {
      console.log('WebSocket连接已关闭');
      buildLogs.innerHTML += '<div class="text-warning">与构建服务器的连接已关闭</div>';

      // 尝试重新连接
      setTimeout(connectWebSocket, 5000);
    };
  }

  // 初始化构建步骤
  function initBuildSteps() {
    const steps = [
      { id: 'init', name: '初始化', icon: 'bi-gear' },
      { id: 'clone', name: '克隆代码', icon: 'bi-git' },
      { id: 'prepare', name: '准备环境', icon: 'bi-tools' },
      { id: 'build', name: '构建镜像', icon: 'bi-box-seam' },
      { id: 'push', name: '推送镜像', icon: 'bi-cloud-upload' },
      { id: 'scan', name: '安全扫描', icon: 'bi-shield-check' },
      { id: 'complete', name: '完成', icon: 'bi-check-circle' }
    ];

    buildSteps.innerHTML = '';
    steps.forEach(step => {
      buildStepStatuses.set(step.id, 'pending');

      const stepElement = document.createElement('div');
      stepElement.className = 'build-step';
      stepElement.id = `build-step-${step.id}`;
      stepElement.innerHTML = `
        <span class="build-step-icon"><i class="bi ${step.icon}"></i></span>
        <span>${step.name}</span>
      `;
      buildSteps.appendChild(stepElement);
    });

    // 设置第一个步骤为活动状态
    updateBuildStep('init', 'active');
  }

  // 更新构建步骤状态
  function updateBuildStep(stepId, status) {
    const stepElement = document.getElementById(`build-step-${stepId}`);
    if (!stepElement) return;

    // 更新状态映射
    buildStepStatuses.set(stepId, status);

    // 移除所有状态类
    stepElement.classList.remove('active', 'completed', 'failed');

    // 添加新状态类
    stepElement.classList.add(status);

    // 更新进度条
    updateBuildProgress();
  }

  // 更新构建进度
  function updateBuildProgress() {
    const total = buildStepStatuses.size;
    let completed = 0;

    buildStepStatuses.forEach(status => {
      if (status === 'completed') completed++;
    });

    const percentage = Math.round((completed / total) * 100);
    buildProgress.style.width = `${percentage}%`;
    buildProgress.setAttribute('aria-valuenow', percentage);

    // 检查是否有失败
    const hasFailed = Array.from(buildStepStatuses.values()).includes('failed');
    if (hasFailed) {
      buildProgress.classList.remove('bg-primary', 'bg-success');
      buildProgress.classList.add('bg-danger');
    } else if (percentage === 100) {
      buildProgress.classList.remove('bg-primary', 'bg-danger');
      buildProgress.classList.add('bg-success');
    } else {
      buildProgress.classList.remove('bg-success', 'bg-danger');
      buildProgress.classList.add('bg-primary');
    }
  }

  // 处理状态更新
  function handleStatusUpdates(updates) {
    updates.forEach(update => {
      // 添加到日志
      appendBuildLog(`[${update.timestamp}] ${update.step}: ${update.message}`);

      // 更新步骤状态
      switch (update.step) {
        case '初始化':
          updateBuildStep('init', update.status === 'failed' ? 'failed' : 'active');
          break;
        case '代码准备':
          updateBuildStep('init', 'completed');
          updateBuildStep('clone', update.status === 'failed' ? 'failed' : 'active');
          break;
        case '构建镜像':
          updateBuildStep('clone', 'completed');
          updateBuildStep('prepare', 'completed');
          updateBuildStep('build', update.status === 'failed' ? 'failed' : 'active');
          break;
        case '构建完成':
          updateBuildStep('build', 'completed');
          updateBuildStep('push', 'active');
          break;
        case '镜像安全扫描':
          updateBuildStep('push', 'completed');
          updateBuildStep('scan', update.status === 'failed' ? 'failed' : 'active');
          break;
        case '构建结果':
          updateBuildStep('scan', 'completed');
          updateBuildStep('complete', update.status === 'failed' ? 'failed' : 'completed');
          break;
      }
    });
  }

  // 添加构建日志
  function appendBuildLog(logText) {
    // 创建新的日志行
    const logLine = document.createElement('div');

    // 处理ANSI颜色代码
    let formattedText = logText
      .replace(/\[31m/g, '<span class="text-danger">')
      .replace(/\[32m/g, '<span class="text-success">')
      .replace(/\[33m/g, '<span class="text-warning">')
      .replace(/\[34m/g, '<span class="text-primary">')
      .replace(/\[35m/g, '<span class="text-info">')
      .replace(/\[36m/g, '<span class="text-info">')
      .replace(/\[0m/g, '</span>');

    logLine.innerHTML = formattedText;

    // 添加到日志容器
    buildLogs.appendChild(logLine);

    // 如果启用了自动滚动，滚动到底部
    if (autoScroll) {
      buildLogs.scrollTop = buildLogs.scrollHeight;
    }
  }

  // 从API获取构建日志
  function fetchBuildLogs(runId) {
    fetch(`https://your-backend-api.com/api/build-logs/${runId}`)
      .then(response => response.json())
      .then(data => {
        // 清空现有日志
        buildLogs.innerHTML = '';

        // 添加新日志
        if (data.logs && data.logs.length > 0) {
          data.logs.forEach(log => {
            appendBuildLog(log);
          });
        } else {
          buildLogs.innerHTML = '<div class="text-center text-muted p-3">暂无构建日志</div>';
        }
      })
      .catch(error => {
        console.error('获取构建日志失败:', error);
        buildLogs.innerHTML = `<div class="text-danger">获取构建日志失败: ${error.message}</div>`;
      });
  }

  // 调试工具 - 发送测试请求
  if (sendTestRequest) {
    sendTestRequest.addEventListener('click', function () {
      const token = debugGithubToken.value;
      if (!token) {
        debugStatus.innerHTML = '<span class="text-danger">请提供GitHub Token</span>';
        return;
      }

      let requestData;
      try {
        requestData = JSON.parse(debugRequestJson.value.trim());
        debugStatus.innerHTML = '<span class="text-warning"><i class="bi bi-hourglass-split"></i> 发送中...</span>';
      } catch (error) {
        debugStatus.innerHTML = `<span class="text-danger">JSON解析错误: ${error.message}</span>`;
        return;
      }

      // 发送API请求
      const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW_FILE}/dispatches`;

      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'Authorization': `token ${token}`
        },
        body: JSON.stringify(requestData)
      })
        .then(response => {
          console.log("测试请求响应:", response);

          if (response.ok || response.status === 204) {
            debugStatus.innerHTML = '<span class="text-success"><i class="bi bi-check-circle"></i> 请求成功!</span>';
            updateBuildStatus('success', `<i class="bi bi-check-circle-fill me-2"></i>测试请求已成功提交!<br><a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions" target="_blank">查看GitHub Actions</a>`);
          } else {
            return response.json().then(errorData => {
              console.error("API错误详情:", errorData);
              debugStatus.innerHTML = `<span class="text-danger"><i class="bi bi-x-circle"></i> 请求失败: ${response.status}</span>`;
              showDebugInfo(errorData);
              throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
            });
          }
        })
        .catch(error => {
          console.error('测试请求出错:', error);
          debugStatus.innerHTML = `<span class="text-danger"><i class="bi bi-x-circle"></i> 错误: ${error.message}</span>`;
        });
    });
  }
}); 