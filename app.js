// Инициализация
let ffmpeg = null;
const { createFFmpeg, fetchFile } = FFmpeg;

// Проверка поддержки браузера
const checkBrowserSupport = () => {
    return !!(window.File && window.FileReader && window.FileList && window.Blob);
};

// Расширенные поддерживаемые форматы
const supportedFormats = {
    'image': {
        name: 'Изображения',
        extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'],
        mobileFormats: ['jpg', 'png', 'webp'],
        description: 'Конвертация изображений'
    },
    'video': {
        name: 'Видео',
        extensions: ['mp4', 'webm', 'mov', 'avi', '3gp', 'mkv'],
        mobileFormats: ['mp4', '3gp', 'webm'],
        description: 'Конвертация видео'
    },
    'audio': {
        name: 'Аудио',
        extensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'wma'],
        mobileFormats: ['mp3', 'm4a', 'aac'],
        description: 'Конвертация аудио'
    },
    'document': {
        name: 'Документы',
        extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages', 'epub'],
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

// Обновляем определение браузера
const deviceInfo = {
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
    isAndroid: /Android/.test(navigator.userAgent),
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
    isTelegram: /Telegram/i.test(navigator.userAgent)
};

// Определение устройства
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    if (!checkBrowserSupport()) {
        showMessage('Ваш браузер не поддерживает необходимые функции', 'error');
        return;
    }

    // Инициализируем FFmpeg
    try {
        ffmpeg = createFFmpeg({ 
            log: true,
            corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
        });
        await ffmpeg.load();
    } catch (error) {
        console.error('Ошибка инициализации FFmpeg:', error);
        showErrorMessage('Ошибка инициализации конвертера');
    }

    // Инициализируем обработчики событий
    initializeEventListeners();
});

// Функция инициализации обработчиков
function initializeEventListeners() {
    const dropZone = document.querySelector('.upload-area');
    const fileInput = document.getElementById('fileInput');
    const filesList = document.getElementById('filesList');

    // Проверяем наличие элементов
    if (!dropZone || !fileInput || !filesList) {
        console.error('Не найдены необходимые элементы DOM');
        return;
    }

    // Настройка для мобильных
    if (isMobile) {
        fileInput.accept = 'image/*,video/*,audio/*,application/*';
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });
    } 
    // Настройка для десктопа
    else {
        // Drag and Drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            handleFiles(Array.from(e.dataTransfer.files));
        });

        dropZone.addEventListener('click', () => {
            fileInput.click();
        });
    }

    // Общие обработчики
    fileInput.addEventListener('change', (e) => {
        handleFiles(Array.from(e.target.files));
    });

    // Обработчики для кнопок пакетных действий
    elements.convertAllBtn?.addEventListener('click', convertAllFiles);
    elements.clearAllBtn?.addEventListener('click', clearAllFiles);

    // Обработка изменения формата
    elements.formatTo.addEventListener('change', () => {
        elements.convertBtn.disabled = !elements.formatTo.value;
    });

    // Обработка нажатия кнопки конвертации
    elements.convertBtn.addEventListener('click', startConversion);
}

// Обработка файла с проверками
async function handleFile(file) {
    try {
        // Проверка размера файла
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
            showMessage('Файл слишком большой. Максимальный размер: 100MB', 'error');
            return;
        }

        // Проверка типа файла
        const fileType = getFileType(file);
        if (!fileType) {
            showMessage('Формат файла не поддерживается', 'error');
            return;
        }

        // Создаем элемент файла
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-info">
                <span class="file-name">${file.name}</span>
                <span class="file-size">${formatFileSize(file.size)}</span>
                <span class="file-type">${supportedFormats[fileType].name}</span>
            </div>
            <div class="convert-controls" style="display: flex !important;">
                <select class="format-select">
                    <option value="">Выберите формат для конвертации</option>
                    ${getFormatOptions(fileType)}
                </select>
                <button class="convert-btn" disabled>Конвертировать</button>
            </div>
            <div class="progress" style="display: none;">
                <div class="progress-bar"></div>
                <span>0%</span>
            </div>
        `;

        // Добавляем в список
        const filesList = document.getElementById('filesList');
        if (!filesList) {
            throw new Error('Элемент списка файлов не найден');
        }
        filesList.appendChild(fileItem);

        // Настраиваем элементы управления
        const select = fileItem.querySelector('.format-select');
        const convertBtn = fileItem.querySelector('.convert-btn');
        const progress = fileItem.querySelector('.progress');

        if (!select || !convertBtn || !progress) {
            throw new Error('Не удалось найти элементы управления');
        }

        // Активируем кнопку при выборе формата
        select.addEventListener('change', () => {
            convertBtn.disabled = !select.value;
        });

        // Обработка конвертации
        convertBtn.addEventListener('click', async () => {
            const targetFormat = select.value;
            if (!targetFormat) return;

            try {
                // Показываем прогресс
                convertBtn.disabled = true;
                progress.style.display = 'block';

                // Конвертируем в зависимости от типа файла
                let result;
                if (fileType === 'document') {
                    result = await convertDocument(file, targetFormat, (p) => {
                        progress.querySelector('.progress-bar').style.width = `${p}%`;
                        progress.querySelector('span').textContent = `${Math.round(p)}%`;
                    });
                } else {
                    // Для остальных типов используем FFmpeg
                    if (!ffmpeg) {
                        ffmpeg = createFFmpeg({ log: true });
                        await ffmpeg.load();
                    }
                    result = await convertMedia(file, targetFormat, (p) => {
                        progress.querySelector('.progress-bar').style.width = `${p}%`;
                        progress.querySelector('span').textContent = `${Math.round(p)}%`;
                    });
                }

                // Скачиваем результат
                const fileName = `converted_${file.name.split('.')[0]}.${targetFormat}`;
                const blob = new Blob([result], { type: getMimeType(targetFormat) });
                
                // Создаем ссылку для скачивания
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                showMessage('Конвертация завершена!');
            } catch (error) {
                console.error('Ошибка конвертации:', error);
                showMessage('Ошибка при конвертации', 'error');
            } finally {
                progress.style.display = 'none';
                convertBtn.disabled = false;
            }
        });

    } catch (error) {
        console.error('Ошибка обработки файла:', error);
        showMessage('Произошла ошибка', 'error');
    }
}

// Функция конвертации документов
async function convertDocument(file, targetFormat, progressCallback) {
    // Здесь используем специальные библиотеки для конвертации документов
    // Например, pdf.js для PDF, docx для Word и т.д.
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                // В зависимости от формата используем разные конвертеры
                let result;
                switch (targetFormat) {
                    case 'pdf':
                        // Конвертация в PDF
                        result = await convertToPdf(e.target.result);
                        break;
                    case 'txt':
                        // Конвертация в TXT
                        result = await convertToTxt(e.target.result);
                        break;
                    // Добавьте другие форматы по необходимости
                    default:
                        throw new Error('Неподдерживаемый формат');
                }
                resolve(result);
            } catch (error) {
                reject(error);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

// Вспомогательные функции
function getFileType(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    for (const [type, info] of Object.entries(supportedFormats)) {
        if (info.extensions.includes(ext)) return type;
    }
    return null;
}

function getFormatOptions(fileType) {
    if (!fileType || !supportedFormats[fileType]) return '';
    const formats = supportedFormats[fileType];
    const isMobile = /Mobile|Android|iPhone/i.test(navigator.userAgent);
    const availableFormats = isMobile ? formats.mobileFormats : formats.extensions;
    return availableFormats
        .map(format => `<option value="${format}">${format.toUpperCase()}</option>`)
        .join('');
}

function showMessage(text, type = 'success') {
    alert(text); // Простое уведомление
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

// Показ уведомлений
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="material-icons">${type === 'success' ? 'check_circle' : 'error'}</i>
        <span>${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Обновляем вспомогательные функции
function showSuccessMessage(message) {
    showToast(message, 'success');
}

function showErrorMessage(message) {
    showToast(message, 'error');
}

// Функция определения MIME-типа
function getMimeType(format) {
    const mimeTypes = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'txt': 'text/plain',
        'rtf': 'application/rtf',
        'epub': 'application/epub+zip',
        // Добавьте другие MIME-типы по необходимости
    };
    return mimeTypes[format] || 'application/octet-stream';
}

// Начало конвертации
async function startConversion() {
    try {
        elements.convertBtn.disabled = true;
        elements.progressBar.style.display = 'block';
        updateProgress(0);

        const targetFormat = elements.formatTo.value;
        const result = await convertFile(currentFile, targetFormat);
        
        if (result) {
            updateProgress(100);
            downloadFile(result, currentFile.name, targetFormat);
        }
    } catch (error) {
        alert('Ошибка при конвертации: ' + error.message);
    } finally {
        elements.convertBtn.disabled = false;
    }
}

// Добавляем функцию конвертации для разных типов файлов
async function convertFile(file, targetFormat) {
    try {
        if (!ffmpeg) {
            ffmpeg = createFFmpeg({ 
                log: true,
                corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
            });
            await ffmpeg.load();
        }

        const inputFileName = 'input_' + file.name;
        const outputFileName = 'output.' + targetFormat;
        
        // Загружаем файл в память FFmpeg
        ffmpeg.FS('writeFile', inputFileName, await fetchFile(file));

        // Определяем команды для конвертации
        const fileType = getFileType(file);
        let outputOptions = [];

        switch (fileType) {
            case 'video':
                outputOptions = [
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23'
                ];
                if (deviceInfo.isMobile) {
                    outputOptions.push('-vf', 'scale=-2:720');
                }
                break;
            case 'audio':
                outputOptions = [
                    '-c:a', 'aac',
                    '-b:a', deviceInfo.isMobile ? '128k' : '192k'
                ];
                break;
            case 'image':
                outputOptions = [
                    '-quality', deviceInfo.isMobile ? '85' : '90'
                ];
                break;
        }

        // Выполняем конвертацию
        await ffmpeg.run('-i', inputFileName, ...outputOptions, outputFileName);

        // Читаем результат
        const data = ffmpeg.FS('readFile', outputFileName);

        // Очищаем файлы
        ffmpeg.FS('unlink', inputFileName);
        ffmpeg.FS('unlink', outputFileName);

        // Создаем blob с правильным mime-type
        const blob = new Blob([data.buffer], { type: getMimeType(targetFormat) });
        
        return blob;
    } catch (error) {
        console.error('Ошибка конвертации:', error);
        showErrorMessage(`Ошибка конвертации: ${error.message}`);
        throw error;
    }
}

// Обновление прогресса
function updateProgress(percent) {
    elements.progressFill.style.width = `${percent}%`;
    elements.progressText.textContent = `${Math.round(percent)}%`;
}

// Улучшенная функция скачивания
function downloadFile(blob, originalFileName, targetFormat) {
    const originalName = originalFileName.split('.')[0];
    const fileName = `${originalName}_converted.${targetFormat}`;
    
    if (deviceInfo.isMobile) {
        // Для мобильных устройств
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        // Очистка
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    } else {
        // Для десктопов
        saveAs(blob, fileName);
    }
    
    showSuccessMessage(`Файл ${fileName} готов к скачиванию`);
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
    showErrorMessage('Произошла ошибка. Попробуйте перезагрузить страницу');
    return false;
};

// Обновленная функция конвертации
async function handleConversion(fileItem, file, targetFormat) {
    try {
        const progressBar = fileItem.querySelector('.progress-container');
        const progressFill = fileItem.querySelector('.progress-fill');
        const progressText = fileItem.querySelector('.progress-text');
        const convertBtn = fileItem.querySelector('.convert-btn');

        progressBar.style.display = 'block';
        convertBtn.disabled = true;

        // Показываем индикатор загрузки для мобильных
        if (deviceInfo.isMobile) {
            showLoadingIndicator();
        }

        const convertedBlob = await convertFile(file, targetFormat, (progress) => {
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `${Math.round(progress)}%`;
        });

        // Адаптивное сохранение файла
        if (deviceInfo.isMobile) {
            await saveMobileFile(convertedBlob, file.name, targetFormat);
        } else {
            saveAs(convertedBlob, `converted_${file.name}.${targetFormat}`);
        }

        showSuccessMessage('Конвертация завершена!');
    } catch (error) {
        showErrorMessage('Ошибка при конвертации');
        console.error(error);
    } finally {
        hideLoadingIndicator();
        convertBtn.disabled = false;
    }
}

// Функция сохранения для мобильных устройств
async function saveMobileFile(blob, originalName, format) {
    const fileName = `converted_${originalName}.${format}`;
    
    if (deviceInfo.isIOS) {
        // Специальная обработка для iOS
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    } else if (deviceInfo.isAndroid) {
        // Специальная обработка для Android
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    }
}
