// Обновляем список поддерживаемых форматов
const supportedFormats = {
    'image': {
        name: 'Изображения',
        extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic', 'heif'],
        mobileFormats: ['jpg', 'webp', 'heic'], // HEIC популярен на iOS
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/heic']
    },
    'video': {
        name: 'Видео',
        extensions: ['mp4', 'webm', 'mov', 'gif', '3gp', 'mkv'],
        mobileFormats: ['mp4', 'webm', '3gp'], // 3GP для старых телефонов
        mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp']
    },
    'audio': {
        name: 'Аудио',
        extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'],
        mobileFormats: ['mp3', 'm4a', 'aac'], // AAC хорошо работает на мобильных
        mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac']
    },
    'document': {
        name: 'Документы',
        extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf'],
        mobileFormats: ['pdf', 'txt'], // PDF отлично работает на мобильных
        mimeTypes: ['application/pdf', 'text/plain']
    },
    'archive': {
        name: 'Архивы',
        extensions: ['zip', 'rar', '7z', 'tar', 'gz'],
        mimeTypes: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed']
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
let ffmpeg = null;

// Инициализация FFmpeg
const { createFFmpeg, fetchFile } = FFmpeg;

// Инициализация элементов DOM
document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        dropZone: document.querySelector('.upload-area'),
        fileInput: document.getElementById('fileInput'),
        filesList: document.getElementById('filesList'),
        batchActions: document.querySelector('.batch-actions'),
        convertAllBtn: document.getElementById('convertAllBtn'),
        clearAllBtn: document.getElementById('clearAllBtn'),
        toastContainer: document.querySelector('.toast-container')
    };

    // Проверяем наличие всех элементов
    if (!elements.dropZone || !elements.fileInput || !elements.filesList) {
        console.error('Не найдены необходимые элементы DOM');
        return;
    }

    // Инициализируем FFmpeg
    const ffmpeg = createFFmpeg({ 
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
    });

    // Инициализируем обработчики событий
    initializeEventListeners(elements, ffmpeg);
});

// Функция инициализации обработчиков событий
function initializeEventListeners(elements, ffmpeg) {
    // Обработчик для кнопки выбора файлов
    elements.selectFile?.addEventListener('click', (e) => {
        e.preventDefault();
        elements.fileInput?.click();
    });

    // Обработчик изменения input file
    elements.fileInput?.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        files.forEach(handleFile);
    });

    // Drag & Drop обработчики
    elements.dropZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.dropZone.classList.add('drag-over');
    });

    elements.dropZone?.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.dropZone.classList.remove('drag-over');
    });

    elements.dropZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.dropZone.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files);
        files.forEach(handleFile);
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

// Обработка файла
function handleFile(file) {
    const fileId = Date.now() + Math.random();
    const fileType = getFileType(file);
    
    if (!fileType) {
        showErrorMessage(`Формат файла ${file.name} не поддерживается`);
        return;
    }

    // Проверка размера файла
    const maxSize = isMobileDevice() ? 500 * 1024 * 1024 : 2048 * 1024 * 1024;
    if (file.size > maxSize) {
        showErrorMessage(`Файл слишком большой. Максимальный размер: ${formatFileSize(maxSize)}`);
        return;
    }

    const fileItem = createFileItem(file, fileId, fileType);
    elements.filesList.appendChild(fileItem);
    
    fileQueue.push({
        id: fileId,
        file: file,
        type: fileType
    });

    updateBatchActionsVisibility();
    showSuccessMessage(`Файл ${file.name} добавлен`);
}

// Определение типа устройства и браузера
const deviceInfo = {
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
    isAndroid: /Android/.test(navigator.userAgent),
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
};

// Обновленная функция создания элемента файла
function createFileItem(file, fileId, fileType) {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.dataset.fileId = fileId;

    // Адаптивная HTML структура
    div.innerHTML = `
        <div class="file-content">
            <div class="file-info">
                <span class="file-name">${file.name}</span>
                <span class="file-size">${formatFileSize(file.size)}</span>
            </div>
            <div class="file-controls">
                <div class="format-select-wrapper">
                    <select class="format-select" aria-label="Выберите формат конвертации">
                        <option value="" disabled selected>Выберите формат</option>
                        ${getFormatOptions(fileType, file.name.split('.').pop())}
                    </select>
                </div>
                <button class="convert-btn" disabled>
                    <span class="btn-text">Конвертировать</span>
                </button>
            </div>
        </div>
        <div class="progress-container" style="display: none;">
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
            <span class="progress-text">0%</span>
        </div>
    `;

    // Добавляем обработчики событий
    const formatSelect = div.querySelector('.format-select');
    const convertBtn = div.querySelector('.convert-btn');
    
    // Универсальные обработчики для всех устройств
    formatSelect.addEventListener('change', () => {
        convertBtn.disabled = !formatSelect.value;
    });

    convertBtn.addEventListener('click', async () => {
        await handleConversion(div, file, formatSelect.value);
    });

    // Специальные обработчики для тач-устройств
    if (deviceInfo.isMobile) {
        div.querySelectorAll('button, select').forEach(element => {
            element.addEventListener('touchstart', e => {
                e.target.style.opacity = '0.7';
            });
            
            element.addEventListener('touchend', e => {
                e.target.style.opacity = '1';
            });
        });
    }

    return div;
}

// Получение иконки для типа файла
function getFileIcon(fileType) {
    const icons = {
        'image': 'image',
        'video': 'videocam',
        'audio': 'audiotrack',
        'document': 'description',
        'archive': 'folder_zip'
    };
    return icons[fileType] || 'insert_drive_file';
}

// Определение типа устройства
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Обновляем функцию getFormatOptions
function getFormatOptions(fileType, currentExt) {
    const isMobile = isMobileDevice();
    const formats = isMobile ? 
        supportedFormats[fileType]?.mobileFormats : 
        supportedFormats[fileType]?.extensions;

    return formats
        ?.filter(ext => ext !== currentExt.toLowerCase())
        .map(ext => `<option value="${ext}">${ext.toUpperCase()}</option>`)
        .join('') || '';
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

// Определение типа файла
function getFileType(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    
    for (const [type, info] of Object.entries(supportedFormats)) {
        if (info.extensions.includes(extension)) {
            return type;
        }
    }
    return null;
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
                if (isMobileDevice()) {
                    outputOptions.push('-vf', 'scale=-2:720');
                }
                break;
            case 'audio':
                outputOptions = [
                    '-c:a', 'aac',
                    '-b:a', isMobileDevice() ? '128k' : '192k'
                ];
                break;
            case 'image':
                outputOptions = [
                    '-quality', isMobileDevice() ? '85' : '90'
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

// Функция определения MIME-типа
function getMimeType(format) {
    const mimeTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp',
        'gif': 'image/gif',
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg'
    };
    return mimeTypes[format] || 'application/octet-stream';
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
    
    if (isMobileDevice()) {
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

// Форматирование размера файла
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
    if (!isMobileDevice()) return blob;

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
