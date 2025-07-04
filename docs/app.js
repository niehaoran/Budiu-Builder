/**
 * Budiu Docker Builder Pro - 前端JS
 * 用于触发GitHub Actions进行Docker镜像构建
 */

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
  const GITHUB_OWNER = 'niehaoran'; // 仓库所有者
  const GITHUB_REPO = 'Budiu-Builder'; // 仓库名
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

  // 公钥 - 用于加密敏感信息
  const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqfTSIZOKdkusOg0vQaHv
FgS3GlOJdsV1sXcPtUxvfiRY0yaZg7D1cDp+twmLVmwiibzsaNvQPbqtSYZ7BiXt
nk8Yf6twPDdwiXvdwlgunJCKd63rY9Q5aeP4h2WsULoJr5hAVGAuMFchih+6xVIy
KO0BBoTpTaTz1F0mxCeaGUfqT4HeR37dwjPgMUfrGFi5kELJIYClaDxatAbPjHAm
Ydr3CJHg82wXsqP9sm4xOr7m1/fenOGGpeNfjZtyM0kt9expc4wBLJ7Z4/Bn8TPm
oMMWmkHbImy4uvflwKiezj9mId8yHrqeCj58wC3e8TGm7qUbLI8jrWH5kA1yTDdj
ZQIDAQAB
-----END PUBLIC KEY-----`;

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
    submitBuildRequest();
  });

  // 监听文件上传，预览上传的Dockerfile内容
  const dockerfileUpload = document.getElementById('dockerfile-upload');
  const filePreviewContainer = document.createElement('div');
  filePreviewContainer.className = 'file-preview mt-2 d-none';
  filePreviewContainer.innerHTML = '<div class="card"><div class="card-header d-flex justify-content-between align-items-center"><h6 class="mb-0">文件预览</h6><button type="button" class="btn-close"></button></div><pre class="card-body p-3 small"></pre></div>';

  if (uploadDockerfileSection) {
    uploadDockerfileSection.appendChild(filePreviewContainer);

    // 关闭预览按钮
    const closePreviewBtn = filePreviewContainer.querySelector('.btn-close');
    closePreviewBtn.addEventListener('click', function () {
      filePreviewContainer.classList.add('d-none');
    });
  }

  if (dockerfileUpload) {
    dockerfileUpload.addEventListener('change', function (e) {
      const file = this.files[0];
      if (!file) {
        filePreviewContainer.classList.add('d-none');
        return;
      }

      const reader = new FileReader();
      reader.onload = function (e) {
        const content = e.target.result;
        const previewElement = filePreviewContainer.querySelector('pre');
        previewElement.textContent = content;
        filePreviewContainer.classList.remove('d-none');

        // 自动设置正确的Dockerfile路径
        const fileNameOnly = file.name;
        if (fileNameOnly.toLowerCase().includes('dockerfile')) {
          document.getElementById('dockerfile-path').value = fileNameOnly;
        }
      };
      reader.readAsText(file);
    });
  }

  /**
   * 提交构建请求
   */
  function submitBuildRequest() {
    // 显示加载状态
    updateBuildStatus('info', '正在验证和准备提交构建请求...');

    // 收集表单数据
    const formData = {
      repository: document.getElementById('repo-url').value,
      branch: document.getElementById('repo-branch').value,
      repo_token: document.getElementById('repo-token').value,
      github_token: document.getElementById('github-token').value,
      dockerfile: document.getElementById('dockerfile-path').value,
      registry: document.getElementById('docker-registry').value,
      docker_username: document.getElementById('docker-username').value,
      docker_password: document.getElementById('docker-password').value,
      image_name: formatImageName(),
      platforms: getSelectedPlatforms()
    };

    // 验证必填字段
    if (!validateForm(formData)) {
      updateBuildStatus('danger', '表单验证失败，请检查所有必填字段');
      return;
    }

    // 如果选择了上传Dockerfile，检查是否选择了文件
    if (document.querySelector('input[name="dockerfile-source"]:checked').value === 'upload') {
      const fileInput = document.getElementById('dockerfile-upload');
      if (fileInput.files.length === 0) {
        updateBuildStatus('danger', '请选择要上传的Dockerfile文件');
        return;
      }

      // 更新Dockerfile路径为上传文件的文件名
      if (!formData.dockerfile || formData.dockerfile === 'Dockerfile') {
        formData.dockerfile = fileInput.files[0].name;
      }
    }

    // 保存配置到本地存储（不包含敏感信息）
    if (saveConfigCheckbox.checked) {
      saveFormConfig(formData);
    }

    // 加密敏感信息
    encryptSensitiveData(formData)
      .then(encryptedData => {
        // 加密成功后触发GitHub Actions工作流
        triggerGitHubWorkflow(formData, encryptedData);
      })
      .catch(error => {
        console.error('加密敏感信息时出错:', error);
        updateBuildStatus('danger', `<i class="bi bi-x-circle-fill me-2"></i>加密敏感信息失败: ${error.message}`);
      });
  }

  /**
   * 加密敏感信息
   * @param {Object} formData 表单数据
   * @returns {Promise<string>} 加密后的Base64字符串
   */
  function encryptSensitiveData(formData) {
    return new Promise((resolve, reject) => {
      try {
        // 创建需要加密的数据对象
        const sensitiveData = {
          docker_password: formData.docker_password
        };

        // 如果提供了repo_token，也进行加密
        if (formData.repo_token) {
          sensitiveData.repo_token = formData.repo_token;
        }

        // 将数据转为JSON字符串
        const dataString = JSON.stringify(sensitiveData);
        console.log("加密前的数据: ", dataString);

        // 导入公钥
        window.crypto.subtle.importKey(
          'spki',
          pemToArrayBuffer(PUBLIC_KEY),
          {
            name: 'RSA-OAEP',
            hash: { name: 'SHA-256' }
          },
          true,
          ['encrypt']
        )
          .then(publicKey => {
            console.log("公钥导入成功");

            // 将数据转为ArrayBuffer
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(dataString);

            // 使用公钥加密数据，确保使用OAEP填充模式和SHA-256哈希算法
            return window.crypto.subtle.encrypt(
              {
                name: 'RSA-OAEP'
              },
              publicKey,
              dataBuffer
            );
          })
          .then(encryptedBuffer => {
            // 将加密后的数据转为Base64
            const encryptedArray = new Uint8Array(encryptedBuffer);
            console.log("加密后的数据长度: ", encryptedArray.length, "字节");

            const base64Encoded = arrayBufferToBase64(encryptedArray);
            console.log("Base64编码后的数据长度: ", base64Encoded.length, "字符");

            // 验证Base64编码是否正确
            try {
              const testDecode = atob(base64Encoded);
              console.log("Base64可以成功解码，长度: ", testDecode.length, "字节");
            } catch (e) {
              console.error("Base64编码验证失败: ", e);
              reject(new Error("Base64编码验证失败"));
              return;
            }

            resolve(base64Encoded);
          })
          .catch(error => {
            console.error("加密过程详细错误: ", error);
            reject(new Error(`加密失败: ${error.message}`));
          });
      } catch (error) {
        console.error("加密过程异常: ", error);
        reject(new Error(`加密过程中出错: ${error.message}`));
      }
    });
  }

  /**
   * 将PEM格式的密钥转换为ArrayBuffer
   * @param {string} pem PEM格式的密钥
   * @returns {ArrayBuffer} 转换后的ArrayBuffer
   */
  function pemToArrayBuffer(pem) {
    // 移除头尾和换行符，并解码Base64
    const base64 = pem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/[\r\n\s]/g, '');

    console.log("处理后的公钥Base64长度: ", base64.length);

    // 解码Base64为ArrayBuffer
    return base64ToArrayBuffer(base64);
  }

  /**
   * 将Base64转换为ArrayBuffer
   * @param {string} base64 Base64字符串
   * @returns {ArrayBuffer} 转换后的ArrayBuffer
   */
  function base64ToArrayBuffer(base64) {
    try {
      const binaryString = atob(base64);
      console.log("Base64解码后二进制长度: ", binaryString.length);

      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (error) {
      console.error("Base64转ArrayBuffer错误: ", error);
      throw new Error("Base64解码失败，请检查格式");
    }
  }

  /**
   * 将ArrayBuffer转换为Base64
   * @param {ArrayBuffer} buffer ArrayBuffer
   * @returns {string} Base64字符串
   */
  function arrayBufferToBase64(buffer) {
    try {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    } catch (error) {
      console.error("ArrayBuffer转Base64错误: ", error);
      throw new Error("Base64编码失败");
    }
  }

  /**
   * 格式化镜像名称（包含仓库地址和标签）
   */
  function formatImageName() {
    const registry = document.getElementById('docker-registry').value;
    const username = document.getElementById('docker-username').value;
    const imageName = document.getElementById('image-name').value;
    const tag = document.getElementById('image-tag').value || 'latest';

    // 格式: registry/username/image:tag
    return `${registry}/${username}/${imageName}:${tag}`;
  }

  /**
   * 获取选中的平台列表
   */
  function getSelectedPlatforms() {
    const checkboxes = document.querySelectorAll('input[name="platforms"]:checked');
    if (checkboxes.length === 0) {
      return 'linux/amd64'; // 默认值
    }
    return Array.from(checkboxes).map(checkbox => checkbox.value).join(',');
  }

  /**
   * 验证表单数据
   */
  function validateForm(formData) {
    // 检查必填字段
    const requiredFields = ['repository', 'branch', 'registry', 'docker_username', 'docker_password', 'image_name'];
    for (const field of requiredFields) {
      if (!formData[field]) {
        return false;
      }
    }

    // 如果选择从仓库使用Dockerfile，需要dockerfile路径
    if (document.querySelector('input[name="dockerfile-source"]:checked').value === 'repo' && !formData.dockerfile) {
      return false;
    }

    return true;
  }

  /**
   * 保存表单配置到localStorage（不包含敏感信息）
   */
  function saveFormConfig(formData) {
    const configToSave = {
      repository: formData.repository,
      branch: formData.branch,
      dockerfile_source: document.querySelector('input[name="dockerfile-source"]:checked').value,
      dockerfile: formData.dockerfile,
      registry: formData.registry,
      docker_username: formData.docker_username,
      image_name: document.getElementById('image-name').value, // 原始名称
      image_tag: document.getElementById('image-tag').value,   // 原始标签
      platforms: formData.platforms
    };

    localStorage.setItem('budiu_builder_config', JSON.stringify(configToSave));
  }

  /**
   * 从localStorage恢复表单配置
   */
  function restoreFormConfig() {
    const savedConfig = localStorage.getItem('budiu_builder_config');
    if (!savedConfig) return;

    try {
      const config = JSON.parse(savedConfig);

      // 恢复表单值
      if (config.repository) document.getElementById('repo-url').value = config.repository;
      if (config.branch) document.getElementById('repo-branch').value = config.branch;
      if (config.dockerfile) document.getElementById('dockerfile-path').value = config.dockerfile;
      if (config.registry) document.getElementById('docker-registry').value = config.registry;
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

  /**
   * 更新构建状态显示
   */
  function updateBuildStatus(type, message) {
    buildStatus.className = `alert alert-${type} text-center`;
    buildStatus.innerHTML = `<p class="mb-0">${message}</p>`;
  }

  /**
   * 显示调试信息
   */
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

  /**
   * 实际触发GitHub Actions工作流
   */
  function triggerGitHubWorkflow(formData, encryptedData) {
    // 检查是否提供了GitHub Token
    if (!formData.github_token) {
      updateBuildStatus('warning', '<i class="bi bi-exclamation-triangle-fill me-2"></i>未提供GitHub Token，无法自动触发工作流。请提供GitHub Token后重试。');
      return;
    }

    updateBuildStatus('warning', '<i class="bi bi-hourglass-split me-2"></i>正在提交构建请求到GitHub Actions...');

    // 构建API请求URL
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW_FILE}/dispatches`;

    // 获取虚拟文件数据
    Promise.resolve(getVirtualFilesJson()).then(filesJson => {
      // 构建请求体
      const requestBody = {
        ref: 'main',
        inputs: {
          repository: formData.repository,
          branch: formData.branch,
          dockerfile: formData.dockerfile,
          image_name: formData.image_name,
          platforms: formData.platforms,
          registry: formData.registry,
          docker_username: formData.docker_username,
          encrypted_data: encryptedData,
          repo_token: '' // 已加密到encrypted_data中，这里留空
        }
      };

      // 添加虚拟文件JSON (如果存在)
      if (filesJson) {
        requestBody.inputs.files_json = filesJson;
      }

      // 准备用于显示的安全版本（隐藏敏感信息）
      const safeRequestBody = JSON.parse(JSON.stringify(requestBody));
      safeRequestBody.inputs.encrypted_data = '********';
      if (filesJson) {
        safeRequestBody.inputs.files_json = '(虚拟文件数据，已省略)';
      }

      // 显示调试信息
      showDebugInfo({
        url: apiUrl,
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'Authorization': 'token ********' // 隐藏真实token
        },
        body: safeRequestBody
      });

      // 发送请求到GitHub API
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'Authorization': `token ${formData.github_token}`
        },
        body: JSON.stringify(requestBody)
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

            // 启动构建监控
            startBuildMonitoring();
          } else {
            // 处理错误响应
            return response.json().then(errorData => {
              console.error("API错误详情:", errorData);
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
    }).catch(error => {
      console.error('处理虚拟文件时出错:', error);
      updateBuildStatus('danger', `<i class="bi bi-x-circle-fill me-2"></i>处理虚拟文件失败: ${error.message}`);
    });
  }

  /**
   * 获取虚拟文件JSON数据
   * 如果用户选择了上传Dockerfile，则处理上传的文件
   */
  function getVirtualFilesJson() {
    // 检查是否选择了上传Dockerfile
    if (document.querySelector('input[name="dockerfile-source"]:checked').value === 'upload') {
      const fileInput = document.getElementById('dockerfile-upload');
      if (fileInput.files.length === 0) {
        return null; // 没有选择文件
      }

      // 获取文件和路径
      const dockerfile = fileInput.files[0];
      const dockerfilePath = document.getElementById('dockerfile-path').value || dockerfile.name;

      // 读取文件内容
      const reader = new FileReader();

      return new Promise((resolve) => {
        reader.onload = function (e) {
          const fileContent = e.target.result;

          // 创建虚拟文件JSON对象
          const filesJson = {};
          filesJson[dockerfilePath] = {
            path: dockerfilePath,
            size: fileContent.length,
            content: fileContent
          };

          // 如果需要创建目录结构
          if (dockerfilePath.includes('/')) {
            const dirPath = dockerfilePath.substring(0, dockerfilePath.lastIndexOf('/'));
            filesJson[dirPath + '/__virtual_dir__'] = {
              path: dirPath + '/__virtual_dir__',
              size: 0,
              content: ""
            };
          }

          resolve(JSON.stringify(filesJson));
        };

        reader.onerror = function () {
          console.error('读取文件失败');
          resolve(null);
        };

        reader.readAsText(dockerfile);
      }).catch(err => {
        console.error('处理上传文件时出错:', err);
        return null;
      });
    }

    // 如果用户在调试面板中提供了虚拟文件JSON
    const debugVirtualFiles = document.getElementById('debug-virtual-files');
    if (debugVirtualFiles && debugVirtualFiles.value.trim()) {
      try {
        // 验证JSON格式
        JSON.parse(debugVirtualFiles.value);
        return debugVirtualFiles.value.trim();
      } catch (e) {
        console.error('无效的虚拟文件JSON:', e);
      }
    }

    return null;
  }

  /**
   * 启动构建监控
   */
  function startBuildMonitoring() {
    // 显示构建日志容器
    buildLogsContainer.classList.remove('d-none');

    // 重置构建状态
    buildStepStatuses.clear();
    buildSteps.innerHTML = '';
    buildProgress.style.width = '0%';
    buildLogs.innerHTML = '<div class="text-center text-muted p-3"><i class="bi bi-hourglass me-2"></i>正在连接到构建服务器...</div>';

    // 在实际应用中，这里应该建立WebSocket连接
    // 简化示例使用定时器模拟进度更新
    simulateBuildProgress();

    // 模拟获取最新的运行ID
    setTimeout(() => {
      currentBuildRunId = 'build-' + Date.now();
      // 初始化构建步骤
      initBuildSteps();
    }, 1000);
  }

  /**
   * 模拟构建进度
   */
  function simulateBuildProgress() {
    const buildSteps = [
      { step: '初始化', message: '开始构建准备', delay: 1000 },
      { step: '代码准备', message: '克隆源代码仓库', delay: 2000 },
      { step: '构建环境', message: '配置Docker构建环境', delay: 2000 },
      { step: '构建镜像', message: '开始构建Docker镜像', delay: 3000 },
      { step: '推送镜像', message: '推送镜像到Docker仓库', delay: 2000 },
      { step: '安全扫描', message: '执行安全漏洞扫描', delay: 2000 },
      { step: '完成', message: '构建任务已完成', delay: 1000 }
    ];

    let stepIndex = 0;

    function processNextStep() {
      if (stepIndex >= buildSteps.length) return;

      const step = buildSteps[stepIndex];
      appendBuildLog(`[${new Date().toISOString()}] ${step.step}: ${step.message}`);

      // 更新构建步骤状态
      updateBuildStepStatus(stepIndex);

      stepIndex++;
      if (stepIndex < buildSteps.length) {
        setTimeout(processNextStep, step.delay);
      }
    }

    // 开始模拟进度
    processNextStep();
  }

  /**
   * 更新构建步骤状态
   */
  function updateBuildStepStatus(currentStep) {
    const steps = ['init', 'clone', 'prepare', 'build', 'push', 'scan', 'complete'];

    // 更新当前步骤为活动状态
    if (currentStep < steps.length) {
      // 将之前的步骤标记为已完成
      for (let i = 0; i < currentStep; i++) {
        updateBuildStep(steps[i], 'completed');
      }

      // 将当前步骤标记为活动状态
      updateBuildStep(steps[currentStep], 'active');
    }
  }

  /**
   * 初始化构建步骤
   */
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

  /**
   * 更新构建步骤状态
   */
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

  /**
   * 更新构建进度
   */
  function updateBuildProgress() {
    const total = buildStepStatuses.size;
    let completed = 0;

    buildStepStatuses.forEach(status => {
      if (status === 'completed') completed++;
    });

    const percentage = Math.round((completed / total) * 100);
    buildProgress.style.width = `${percentage}%`;
    buildProgress.setAttribute('aria-valuenow', percentage);

    // 设置进度条颜色
    if (Array.from(buildStepStatuses.values()).includes('failed')) {
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

  /**
   * 添加构建日志
   */
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

  /**
   * 从API获取构建日志
   */
  function fetchBuildLogs(runId) {
    // 在实际应用中，这里应该调用API获取日志
    // 简化示例，直接添加一条通知消息
    appendBuildLog(`[${new Date().toISOString()}] 获取构建日志: ${runId}`);
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

        // 添加虚拟文件JSON
        const debugVirtualFiles = document.getElementById('debug-virtual-files');
        if (debugVirtualFiles && debugVirtualFiles.value.trim()) {
          try {
            // 验证JSON是否有效
            JSON.parse(debugVirtualFiles.value.trim());
            requestData.inputs.files_json = debugVirtualFiles.value.trim();
          } catch (error) {
            debugStatus.innerHTML = `<span class="text-danger">虚拟文件JSON解析错误: ${error.message}</span>`;
            return;
          }
        }

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

  // 添加测试加密功能
  const testEncryptInput = document.getElementById('test-encrypt-input');
  const testEncryptButton = document.getElementById('test-encrypt-button');
  const encryptionResult = document.getElementById('encryption-result');
  const encryptionResultContainer = document.getElementById('encryption-result-container');
  const copyEncryptedButton = document.getElementById('copy-encrypted-button');

  if (testEncryptButton) {
    testEncryptButton.addEventListener('click', function () {
      try {
        // 获取输入的JSON
        const inputJson = testEncryptInput.value.trim();
        let jsonData;
        try {
          jsonData = JSON.parse(inputJson);
        } catch (error) {
          alert('输入的内容不是有效的JSON格式');
          return;
        }

        // 使用公钥加密
        encryptJson(jsonData)
          .then(encryptedBase64 => {
            // 显示加密结果
            encryptionResultContainer.classList.remove('d-none');
            encryptionResult.value = encryptedBase64;
            copyEncryptedButton.classList.remove('d-none');

            // 自动复制到请求JSON
            const requestJson = document.getElementById('debug-request-json');
            if (requestJson) {
              try {
                const requestData = JSON.parse(requestJson.value);
                requestData.inputs.encrypted_data = encryptedBase64;
                requestJson.value = JSON.stringify(requestData, null, 2);
              } catch (error) {
                console.error('更新请求JSON失败:', error);
              }
            }
          })
          .catch(error => {
            alert(`加密失败: ${error.message}`);
            console.error('测试加密失败:', error);
          });
      } catch (error) {
        alert(`处理失败: ${error.message}`);
        console.error('加密处理失败:', error);
      }
    });
  }

  if (copyEncryptedButton) {
    copyEncryptedButton.addEventListener('click', function () {
      encryptionResult.select();
      document.execCommand('copy');
      this.innerHTML = '<i class="bi bi-check2 me-1"></i>已复制';
      setTimeout(() => {
        this.innerHTML = '<i class="bi bi-clipboard me-1"></i>复制';
      }, 2000);
    });
  }

  /**
   * 加密JSON数据
   * @param {Object} jsonData 要加密的JSON对象
   * @returns {Promise<string>} 加密后的Base64字符串
   */
  function encryptJson(jsonData) {
    return new Promise((resolve, reject) => {
      try {
        console.log('开始加密JSON:', jsonData);
        // 将数据转为JSON字符串
        const dataString = JSON.stringify(jsonData);
        console.log('JSON字符串:', dataString);

        // 导入公钥
        window.crypto.subtle.importKey(
          'spki',
          pemToArrayBuffer(PUBLIC_KEY),
          {
            name: 'RSA-OAEP',
            hash: { name: 'SHA-256' }
          },
          true,
          ['encrypt']
        )
          .then(publicKey => {
            console.log('公钥导入成功');

            // 将数据转为ArrayBuffer
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(dataString);
            console.log('数据转为ArrayBuffer, 长度:', dataBuffer.byteLength);

            // 使用公钥加密数据
            console.log('开始加密...');
            return window.crypto.subtle.encrypt(
              {
                name: 'RSA-OAEP'
              },
              publicKey,
              dataBuffer
            );
          })
          .then(encryptedBuffer => {
            console.log('加密完成, 加密后数据长度:', encryptedBuffer.byteLength);

            // 将加密后的数据转为Base64
            const encryptedArray = new Uint8Array(encryptedBuffer);
            const base64Encoded = arrayBufferToBase64(encryptedArray);
            console.log('Base64编码完成, 长度:', base64Encoded.length);

            resolve(base64Encoded);
          })
          .catch(error => {
            console.error('加密过程出错:', error);
            reject(error);
          });
      } catch (error) {
        console.error('加密JSON时出错:', error);
        reject(error);
      }
    });
  }
}); 