                            // Инициализация
                            const { createFFmpeg } = FFmpeg;
                            const ffmpeg = createFFmpeg({ 
                                log: true,
                                corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
                            });
                            let isConverting = false;

                            // Определение устройства и браузера
                            const deviceInfo = {
                                isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
                                isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent)
                            };

                            // Расширенные поддерживаемые форматы
                            const supportedFormats = {
                                'image': {
                                    name: 'Изображения',
                                    extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'ico', 'svg'],
                                    mobileFormats: ['jpg', 'png', 'webp'],
                                    description: 'Конвертация изображений'
                                },
                                'video': {
                                    name: 'Видео',
                                    extensions: ['mp4', 'webm', 'mov', '3gp', 'avi', 'mkv', 'flv', 'wmv', 'm4v'],
                                    mobileFormats: ['mp4', '3gp', 'webm'],
                                    description: 'Конвертация видео'
                                },
                                'audio': {
                                    name: 'Аудио',
                                    extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'wma', 'flac', 'alac', 'aiff'],
                                    mobileFormats: ['mp3', 'm4a', 'aac'],
                                    description: 'Конвертация аудио'
                                },
                                'document': {
                                    name: 'Документы',
                                    extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages', 'epub', 'fb2', 'mobi'],
                                    mobileFormats: ['pdf', 'txt', 'epub'],
                                    description: 'Конвертация документов'
                                }
                            };

                            // Сначала определяем все элементы DOM
                            const elements = {
                                dropZone: document.querySelector('.upload-area'),
                                fileInput: document.getElementById('fileInput'),
                                selectFile: document.querySelector('.custom-file-input'),
                                filesList: document.getElementById('filesList'),
                                batchActions: document.getElementById('batchActions'),
                                convertAllBtn: document.getElementById('convertAllBtn'),
                                clearAllBtn: document.getElementById('clearAllBtn'),
                                toastContainer: document.getElementById('toastContainer'),
                                progressBar: document.querySelector('.progress-bar'),
                                progressFill: document.querySelector('.progress-fill'),
                                progressText: document.querySelector('.progress-text'),
                                fileName: document.getElementById('fileName'),
                                fileSize: document.getElementById('fileSize'),
                                formatTo: document.getElementById('formatTo'),
                                convertBtn: document.getElementById('convertBtn'),
                                conversionOptions: document.getElementById('conversionOptions')
                            };

                            let fileQueue = [];

                            // Добавим проверку совместимости браузера
                            function checkBrowserSupport() {
                                // Проверяем основные API
                                const requirements = {
                                    fileReader: typeof FileReader !== 'undefined',
                                    blob: typeof Blob !== 'undefined',
                                    arrayBuffer: typeof ArrayBuffer !== 'undefined',
                                    promise: typeof Promise !== 'undefined',
                                    webAssembly: typeof WebAssembly !== 'undefined'
                                };

                                // Проверяем iOS Safari отдельно
                                const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                                
                                if (isIOSSafari) {
                                    // Специальная обработка для iOS Safari
                                    document.documentElement.classList.add('ios');
                                }

                                // Проверяем Android
                                const isAndroid = /Android/.test(navigator.userAgent);
                                if (isAndroid) {
                                    document.documentElement.classList.add('android');
                                }

                                return Object.values(requirements).every(req => req === true);
                            }

                            // Инициализация с проверкой устройства
                            document.addEventListener('DOMContentLoaded', () => {
                                if (!checkBrowserSupport()) {
                                    alert('Ваш браузер может не поддерживать все функции. Рекомендуем использовать последнюю версию Chrome, Firefox, Safari или Edge.');
                                }

                                // Оптимизация для мобильных устройств
                                if (/Mobi|Android/i.test(navigator.userAgent)) {
                                    document.body.classList.add('mobile-device');
                                }
                            });

                            // Обработка файла
                            async function handleFile(file) {
                                try {
                                    const fileType = getFileType(file);
                                    if (!fileType) {
                                        showToast(`Формат файла ${file.name} не поддерживается`, 'error');
                                        return;
                                    }

                                    const fileItem = createFileItem(file, fileType);
                                    document.getElementById('filesList').appendChild(fileItem);
                                } catch (error) {
                                    showToast('Ошибка обработки файла', 'error');
                                    console.error('Ошибка обработки файла:', error);
                                }
                            }

                            // Создание элемента файла
                            function createFileItem(file, fileType) {
                                const div = document.createElement('div');
                                div.className = 'file-item';
                                div.innerHTML = `
                                    <div class="file-info">
                                        <span class="file-name">${file.name}</span>
                                        <span class="file-size">${formatFileSize(file.size)}</span>
                                    </div>
                                    <div class="convert-controls">
                                        <div class="format-select-container">
                                            <select class="format-select">
                                                <option value="" disabled selected>Выберите формат конвертации</option>
                                                ${getFormatOptions(fileType)}
                                            </select>
                                        </div>
                                        <button class="convert-btn" disabled>Конвертировать</button>
                                    </div>
                                    <div class="progress" style="display: none;">
                                        <div class="progress-bar"></div>
                                        <div class="progress-text">Подготовка к конвертации...</div>
                                    </div>
                                `;

                                const select = div.querySelector('.format-select');
                                const convertBtn = div.querySelector('.convert-btn');
                                const progress = div.querySelector('.progress');
                                const progressBar = progress.querySelector('.progress-bar');

                                select.addEventListener('change', () => {
                                    convertBtn.disabled = !select.value;
                                });

                                convertBtn.addEventListener('click', async () => {
                                    const targetFormat = select.value;
                                    if (!targetFormat || isConverting) return;

                                    try {
                                        convertBtn.disabled = true;
                                        progress.style.display = 'block';
                                        select.disabled = true;

                                        const result = await convertFile(file, targetFormat, (percent) => {
                                            progressBar.style.width = `${percent}%`;
                                        });

                                        const fileName = `converted_${file.name.split('.')[0]}.${targetFormat}`;
                                        await saveFile(result, fileName, targetFormat);

                                        showToast('Конвертация завершена!', 'success');
                                    } catch (error) {
                                        showToast(error.message || 'Ошибка при конвертации', 'error');
                                    } finally {
                                        progress.style.display = 'none';
                                        convertBtn.disabled = false;
                                        select.disabled = false;
                                        progressBar.style.width = '0%';
                                    }
                                });

                                return div;
                            }

                            // Обновленная функция конвертации
                            async function convertFile(file, targetFormat, progressCallback) {
                                if (!ffmpeg.isLoaded()) {
                                    await ffmpeg.load();
                                }

                                const inputFormat = file.name.split('.').pop().toLowerCase();
                                const inputFileName = `input.${inputFormat}`;
                                const outputFileName = `output.${targetFormat}`;

                                try {
                                    ffmpeg.FS('writeFile', inputFileName, await fetchFile(file));
                                    
                                    let args = [];
                                    
                                    // Настройки конвертации в зависимости от типа файла
                                    if (file.type.startsWith('video/')) {
                                        args = [
                                            '-i', inputFileName,
                                            '-c:v', 'libx264',
                                            '-preset', 'medium',
                                            '-c:a', 'aac',
                                            '-b:a', '128k',
                                            outputFileName
                                        ];
                                    } else if (file.type.startsWith('audio/')) {
                                        args = [
                                            '-i', inputFileName,
                                            '-c:a', 'aac',
                                            '-b:a', '192k',
                                            outputFileName
                                        ];
                                    } else if (file.type.startsWith('image/')) {
                                        args = ['-i', inputFileName];
                                        if (targetFormat === 'webp') {
                                            args.push('-quality', '90');
                                        }
                                        args.push(outputFileName);
                                    }

                                    await ffmpeg.run(...args);
                                    
                                    const data = ffmpeg.FS('readFile', outputFileName);
                                    
                                    // Очистка
                                    ffmpeg.FS('unlink', inputFileName);
                                    ffmpeg.FS('unlink', outputFileName);

                                    return new Uint8Array(data.buffer);
                                } catch (error) {
                                    console.error('Ошибка конвертации:', error);
                                    throw new Error('Ошибка при конвертации файла');
                                }
                            }

                            // Функция для конвертации документов
                            async function convertDocument(file, targetFormat) {
                                return new Promise((resolve, reject) => {
                                    const reader = new FileReader();
                                    reader.onload = async (e) => {
                                        try {
                                            let result;
                                            // Здесь будет логика конвертации документов
                                            // В реальном приложении нужно подключить соответствующие библиотеки
                                            resolve(result);
                                        } catch (error) {
                                            reject(error);
                                        }
                                    };
                                    reader.readAsArrayBuffer(file);
                                });
                            }

                            // Сохранение файла
                            async function saveFile(data, fileName, format) {
                                const blob = new Blob([data], { type: getMimeType(format) });
                                
                                if (deviceInfo.isMobile) {
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = fileName;
                                    document.body.appendChild(a);
                                    a.click();
                                    setTimeout(() => {
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                    }, 100);
                                } else {
                                    saveAs(blob, fileName);
                                }
                            }

                            // Обработчики для загрузки файлов
                            document.addEventListener('DOMContentLoaded', () => {
                                const uploadArea = document.querySelector('.upload-area');
                                const fileInput = document.querySelector('.file-input');

                                // Обработка клика по области загрузки
                                uploadArea.addEventListener('click', () => {
                                    fileInput.click();
                                });

                                // Обработка выбора файла через input
                                fileInput.addEventListener('change', (e) => {
                                    if (e.target.files.length > 0) {
                                        handleFileUpload(e.target.files[0]);
                                    }
                                });

                                // Обработка drag and drop
                                uploadArea.addEventListener('dragover', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    uploadArea.classList.add('dragover');
                                });

                                uploadArea.addEventListener('dragleave', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    uploadArea.classList.remove('dragover');
                                });

                                uploadArea.addEventListener('drop', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    uploadArea.classList.remove('dragover');
                                    
                                    if (e.dataTransfer.files.length > 0) {
                                        handleFileUpload(e.dataTransfer.files[0]);
                                    }
                                });
                            });

                            // Функция обработки загруженного файла
                            function handleFileUpload(file) {
                                const fileType = getFileType(file);
                                const formats = getAvailableFormats(fileType);
                                
                                // Получаем имя файла без расширения
                                const fileName = file.name.split('.')[0];
                                
                                // Показываем информацию о файле
                                const fileItem = document.createElement('div');
                                fileItem.className = 'file-item';
                                fileItem.innerHTML = `
                                    <div class="file-info">
                                        <span class="file-name">${file.name}</span>
                                        <span class="file-size">${formatFileSize(file.size)}</span>
                                    </div>
                                `;

                                // Создаем контейнер для элементов конвертации
                                const convertControls = document.createElement('div');
                                convertControls.className = 'convert-controls';
                                convertControls.style.display = 'block'; // Показываем элементы
                                convertControls.innerHTML = `
                                    <select class="format-select">
                                        ${formats.map(format => `<option value="${format}">${format.toUpperCase()}</option>`).join('')}
                                    </select>
                                    <input type="text" class="filename-field" value="${fileName}" placeholder="Введите имя файла">
                                    <button class="convert-btn" onclick="startConversion('${file.name}')">Конвертировать</button>
                                `;

                                fileItem.appendChild(convertControls);

                                // Очищаем предыдущий файл если есть
                                const container = document.querySelector('.container');
                                const existingFile = container.querySelector('.file-item');
                                if (existingFile) {
                                    existingFile.remove();
                                }

                                // Добавляем новый файл
                                container.appendChild(fileItem);

                                // Добавляем обработчик изменения формата
                                const formatSelect = fileItem.querySelector('.format-select');
                                const filenameField = fileItem.querySelector('.filename-field');
                                
                                formatSelect.addEventListener('change', () => {
                                    const currentName = filenameField.value.split('.')[0];
                                    filenameField.value = `${currentName}`;
                                });
                            }

                            // Определение типа файла
                            function getFileType(file) {
                                const extension = file.name.split('.').pop().toLowerCase();
                                
                                const typeMap = {
                                    // Изображения
                                    'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'webp': 'image', 
                                    'bmp': 'image', 'tiff': 'image', 'heic': 'image', 'raw': 'image',
                                    
                                    // Видео
                                    'mp4': 'video', 'webm': 'video', 'avi': 'video', 'mov': 'video', 'mkv': 'video',
                                    '3gp': 'video', 'flv': 'video', 'wmv': 'video', 'm4v': 'video',
                                    
                                    // Аудио
                                    'mp3': 'audio', 'wav': 'audio', 'ogg': 'audio', 'm4a': 'audio', 'aac': 'audio',
                                    'flac': 'audio', 'wma': 'audio', 'aiff': 'audio', 'alac': 'audio',
                                    
                                    // Документы
                                    'pdf': 'document', 'doc': 'document', 'docx': 'document', 'txt': 'document',
                                    'rtf': 'document', 'odt': 'document', 'pages': 'document', 'epub': 'document',
                                    'fb2': 'document', 'mobi': 'document'
                                };
                                
                                return typeMap[extension] || 'unknown';
                            }

                            // Функция получения доступных форматов для конвертации
                            function getAvailableFormats(fileType) {
                                const formats = {
                                    'image': {
                                        desktop: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'ico', 'svg'],
                                        mobile: ['jpg', 'png', 'webp']
                                    },
                                    'video': {
                                        desktop: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v'],
                                        mobile: ['mp4', '3gp', 'webm']
                                    },
                                    'audio': {
                                        desktop: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'wma', 'flac', 'alac'],
                                        mobile: ['mp3', 'm4a', 'aac']
                                    },
                                    'document': {
                                        desktop: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'epub'],
                                        mobile: ['pdf', 'txt', 'epub']
                                    }
                                };

                                // Определяем, мобильное устройство или десктоп
                                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                                
                                return formats[fileType] ? (isMobile ? formats[fileType].mobile : formats[fileType].desktop) : [];
                            }

                            // Обновление списка форматов в селекте
                            function updateFormatSelect(formats) {
                                const select = document.querySelector('.format-select');
                                select.innerHTML = formats.map(format => 
                                    `<option value="${format}">${format.toUpperCase()}</option>`
                                ).join('');
                            }

                            // Вспомогательные функции
                            function getFormatOptions(fileType) {
                                const formats = {
                                    'video': [
                                        { value: 'mp4', label: 'MP4 - Видео' },
                                        { value: 'webm', label: 'WebM - Веб-видео' },
                                        { value: 'mov', label: 'MOV - Apple QuickTime' },
                                        { value: '3gp', label: '3GP - Мобильное видео' },
                                        { value: 'avi', label: 'AVI - Видео формат' }
                                    ],
                                    'audio': [
                                        { value: 'mp3', label: 'MP3 - Аудио' },
                                        { value: 'wav', label: 'WAV - Без сжатия' },
                                        { value: 'ogg', label: 'OGG - Открытый формат' },
                                        { value: 'm4a', label: 'M4A - AAC аудио' },
                                        { value: 'aac', label: 'AAC - Продвинутое аудио' }
                                    ],
                                    'image': [
                                        { value: 'jpg', label: 'JPG - Фото' },
                                        { value: 'png', label: 'PNG - Без потерь' },
                                        { value: 'webp', label: 'WebP - Веб-формат' },
                                        { value: 'gif', label: 'GIF - Анимация' },
                                        { value: 'bmp', label: 'BMP - Bitmap' }
                                    ]
                                };

                                if (!fileType || !formats[fileType]) return '';

                                return formats[fileType]
                                    .map(format => `<option value="${format.value}">${format.label}</option>`)
                                    .join('');
                            }

                            function formatFileSize(bytes) {
                                if (bytes === 0) return '0 Bytes';
                                const k = 1024;
                                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                                const i = Math.floor(Math.log(bytes) / Math.log(k));
                                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                            }

                            function showToast(message, type = 'success') {
                                const toast = document.createElement('div');
                                toast.className = `toast ${type}`;
                                toast.textContent = message;
                                
                                const container = document.getElementById('toastContainer');
                                if (container) {
                                    container.appendChild(toast);
                                    setTimeout(() => toast.remove(), 3000);
                                }
                            }

                            // Обновленная функция getMimeType
                            function getMimeType(format) {
                                const mimeTypes = {
                                    // Изображения
                                    'jpg': 'image/jpeg',
                                    'jpeg': 'image/jpeg',
                                    'png': 'image/png',
                                    'webp': 'image/webp',
                                    'gif': 'image/gif',
                                    'bmp': 'image/bmp',
                                    'tiff': 'image/tiff',
                                    'ico': 'image/x-icon',
                                    'svg': 'image/svg+xml',
                                    
                                    // Видео
                                    'mp4': 'video/mp4',
                                    'webm': 'video/webm',
                                    'mov': 'video/quicktime',
                                    '3gp': 'video/3gpp',
                                    'avi': 'video/x-msvideo',
                                    'mkv': 'video/x-matroska',
                                    'flv': 'video/x-flv',
                                    'wmv': 'video/x-ms-wmv',
                                    
                                    // Аудио
                                    'mp3': 'audio/mpeg',
                                    'wav': 'audio/wav',
                                    'ogg': 'audio/ogg',
                                    'm4a': 'audio/mp4',
                                    'aac': 'audio/aac',
                                    'wma': 'audio/x-ms-wma',
                                    'flac': 'audio/flac',
                                    'alac': 'audio/alac',
                                    'aiff': 'audio/aiff',
                                    
                                    // Документы
                                    'pdf': 'application/pdf',
                                    'doc': 'application/msword',
                                    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                    'txt': 'text/plain',
                                    'rtf': 'application/rtf',
                                    'epub': 'application/epub+zip',
                                    'fb2': 'application/x-fictionbook+xml',
                                    'mobi': 'application/x-mobipocket-ebook'
                                };
                                return mimeTypes[format] || 'application/octet-stream';
                            }

                            // Конвертация всех файлов
                            async function convertAllFiles() {
                                const fileItems = document.querySelectorAll('.file-item');
                                
                                for (const fileItem of fileItems) {
                                    const fileId = fileItem.dataset.fileId;
                                    const fileData = fileQueue.find(f => f.id === fileId);
                                    const formatSelect = fileItem.querySelector('.format-select');
                                    const targetFormat = formatSelect.value;
                                    
                                    if (fileData && targetFormat) {
                                        const convertBtn = fileItem.querySelector('.convert-btn');
                                        convertBtn.click(); // Запускаем конвертацию для каждого файла
                                    }
                                }
                            }

                            // Очистка всех файлов
                            function clearAllFiles() {
                                fileQueue = [];
                                elements.filesList.innerHTML = '';
                                updateBatchActionsVisibility();
                            }

                            // Удаление файла
                            function removeFile(fileId) {
                                fileQueue = fileQueue.filter(f => f.id !== fileId);
                                document.querySelector(`[data-file-id="${fileId}"]`).remove();
                                updateBatchActionsVisibility();
                            }

                            // Обновление видимости кнопок пакетной обработки
                            function updateBatchActionsVisibility() {
                                elements.batchActions.style.display = 
                                    fileQueue.length > 0 ? 'flex' : 'none';
                            }

                            // Добавляем стили для прогресс бара в CSS
                            const style = document.createElement('style');
                            style.textContent = `
                                .file-item .progress-bar {
                                    width: 100%;
                                    height: 4px;
                                    background-color: #ddd;
                                    border-radius: 2px;
                                    margin-top: 10px;
                                    position: relative;
                                }

                                .file-item .progress-fill {
                                    height: 100%;
                                    background-color: var(--primary-color);
                                    border-radius: 2px;
                                    width: 0;
                                    transition: width 0.3s ease;
                                }

                                .file-item .progress-text {
                                    position: absolute;
                                    right: 0;
                                    top: -20px;
                                    font-size: 12px;
                                    color: #999;
                                }

                                .file-item .file-actions {
                                    display: flex;
                                    gap: 10px;
                                    align-items: center;
                                }

                                .file-item .format-select {
                                    padding: 5px;
                                    border-radius: 4px;
                                    border: 1px solid #ddd;
                                }
                            `;

                            document.head.appendChild(style);

                            // Добавляем оптимизацию для мобильных форматов
                            async function optimizeForMobile(blob, fileType, targetFormat) {
                                if (!deviceInfo.isMobile) return blob;

                                const ffmpeg = createFFmpeg({ log: true });
                                await ffmpeg.load();

                                switch (fileType) {
                                    case 'video':
                                        // Оптимизация для мобильного видео
                                        if (targetFormat === 'mp4') {
                                            await ffmpeg.run('-i', 'input.mp4', 
                                                '-c:v', 'libx264', 
                                                '-preset', 'fast',
                                                '-crf', '28',
                                                '-movflags', '+faststart',
                                                '-vf', 'scale=-2:720', // 720p для мобильных
                                                'output.mp4'
                                            );
                                        }
                                        break;
                                    case 'image':
                                        // Оптимизация для мобильных изображений
                                        if (targetFormat === 'webp') {
                                            await ffmpeg.run('-i', 'input.webp',
                                                '-quality', '85',
                                                '-resize', '1280x720>', // Максимальный размер
                                                'output.webp'
                                            );
                                        }
                                        break;
                                    case 'audio':
                                        // Оптимизация для мобильного аудио
                                        if (targetFormat === 'mp3') {
                                            await ffmpeg.run('-i', 'input.mp3',
                                                '-b:a', '128k', // Битрейт для мобильных
                                                'output.mp3'
                                            );
                                        }
                                        break;
                                }

                                return blob;
                            }

                            // Добавляем определение возможностей устройства
                            function getDeviceCapabilities() {
                                return {
                                    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
                                    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
                                    isAndroid: /Android/.test(navigator.userAgent),
                                    maxFileSize: 500 * 1024 * 1024, // 500MB для мобильных
                                    supportedFormats: {
                                        image: ['jpg', 'webp', 'heic'],
                                        video: ['mp4', 'webm', '3gp'],
                                        audio: ['mp3', 'm4a', 'aac']
                                    }
                                };
                            }

                            // Добавляем обработчик ошибок
                            window.onerror = function(message, source, lineno, colno, error) {
                                console.error('Глобальная ошибка:', error);
                                showToast('Произошла ошибка. Попробуйте перезагрузить страницу', 'error');
                                return false;
                            };

                            // Функция начала конвертации
                            async function startConversion(originalFileName) {
                                const fileItem = document.querySelector('.file-item');
                                const formatSelect = fileItem.querySelector('.format-select');
                                const filenameField = fileItem.querySelector('.filename-field');
                                const targetFormat = formatSelect.value;
                                
                                // Получаем оригинальный файл
                                const fileInput = document.querySelector('.file-input');
                                const file = fileInput.files[0];

                                if (!file) {
                                    alert('Пожалуйста, выберите файл');
                                    return;
                                }

                                // Получаем имя файла
                                let outputFileName = filenameField.value;
                                if (!outputFileName) {
                                    // Если имя не задано, используем оригинальное имя с новым расширением
                                    const baseName = originalFileName.split('.')[0];
                                    outputFileName = `${baseName}.${targetFormat}`;
                                } else if (!outputFileName.endsWith(`.${targetFormat}`)) {
                                    outputFileName += `.${targetFormat}`;
                                }

                                try {
                                    // Показываем прогресс
                                    const convertBtn = fileItem.querySelector('.convert-btn');
                                    convertBtn.disabled = true;
                                    convertBtn.textContent = 'Конвертация...';

                                    // Конвертируем файл
                                    await convertFile(file, targetFormat, outputFileName);

                                    convertBtn.textContent = 'Готово!';
                                    setTimeout(() => {
                                        convertBtn.disabled = false;
                                        convertBtn.textContent = 'Конвертировать';
                                    }, 2000);
                                } catch (error) {
                                    console.error('Ошибка конвертации:', error);
                                    convertBtn.disabled = false;
                                    convertBtn.textContent = 'Ошибка';
                                    alert('Произошла ошибка при конвертации. Попробуйте еще раз.');
                                }
                            }
