// Обновляем список поддерживаемых форматов
const supportedFormats = {
    'image': {
        name: 'Изображения',
        extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'],
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff']
    },
    'video': {
        name: 'Видео',
        extensions: ['mp4', 'avi', 'mkv', 'mov', 'webm', 'gif'],
        mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime']
    },
    'audio': {
        name: 'Аудио',
        extensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a'],
        mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac']
    },
    'document': {
        name: 'Документы',
        extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt'],
        mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
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

// Ждем полной загрузки DOM перед инициализацией
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем наличие всех необходимых элементов
    if (!elements.dropZone || !elements.fileInput || !elements.filesList) {
        console.error('Не найдены необходимые элементы DOM');
        return;
    }

    // Инициализируем обработчики событий
    initializeEventListeners();
});

// Функция инициализации обработчиков событий
function initializeEventListeners() {
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

// Создание элемента файла
function createFileItem(file, fileId, fileType) {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.dataset.fileId = fileId;

    div.innerHTML = `
        <i class="material-icons file-icon">${getFileIcon(fileType)}</i>
        <div class="file-info">
            <div class="file-name">${file.name}</div>
            <div class="file-size">${formatFileSize(file.size)}</div>
        </div>
        <div class="file-actions">
            <select class="format-select">
                ${getFormatOptions(fileType, file.name.split('.').pop())}
            </select>
            <button class="primary-button convert-btn">
                Конвертировать
            </button>
        </div>
        <div class="progress-bar" style="display: none;">
            <div class="progress-fill"></div>
            <span class="progress-text">0%</span>
        </div>
    `;

    // Добавляем обработчик для кнопки конвертации
    const convertBtn = div.querySelector('.convert-btn');
    convertBtn.addEventListener('click', async () => {
        const formatSelect = div.querySelector('.format-select');
        const targetFormat = formatSelect.value;
        
        if (!targetFormat) {
            showErrorMessage('Выберите формат конвертации');
            return;
        }

        // Показываем прогресс бар
        const progressBar = div.querySelector('.progress-bar');
        const progressFill = div.querySelector('.progress-fill');
        const progressText = div.querySelector('.progress-text');
        progressBar.style.display = 'block';
        convertBtn.disabled = true;
        formatSelect.disabled = true;

        try {
            // Начинаем конвертацию
            updateProgress(progressFill, progressText, 10);
            const result = await convertFile(file, targetFormat);
            updateProgress(progressFill, progressText, 90);

            if (result) {
                // Скачиваем файл
                downloadFile(result, file.name, targetFormat);
                updateProgress(progressFill, progressText, 100);
                showSuccessMessage(`Файл ${file.name} успешно сконвертирован`);
            }
        } catch (error) {
            showErrorMessage(`Ошибка конвертации: ${error.message}`);
        } finally {
            // Возвращаем кнопки в нормальное состояние через 2 секунды
            setTimeout(() => {
                progressBar.style.display = 'none';
                convertBtn.disabled = false;
                formatSelect.disabled = false;
                updateProgress(progressFill, progressText, 0);
            }, 2000);
        }
    });

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

// Получение опций форматов
function getFormatOptions(fileType, currentExt) {
    if (!supportedFormats[fileType]) return '';
    
    return supportedFormats[fileType].extensions
        .filter(ext => ext !== currentExt.toLowerCase())
        .map(ext => `<option value="${ext}">${ext.toUpperCase()}</option>`)
        .join('');
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
            ffmpeg = createFFmpeg({ log: true });
            await ffmpeg.load();
        }

        const inputFileName = 'input_' + file.name;
        const outputFileName = 'output.' + targetFormat;
        
        // Загружаем файл в память FFmpeg
        ffmpeg.FS('writeFile', inputFileName, new Uint8Array(await file.arrayBuffer()));

        // Определяем команды для конвертации в зависимости от типа файла
        const fileType = getFileType(file);
        let outputOptions = [];

        switch (fileType) {
            case 'video':
                outputOptions = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '23'];
                break;
            case 'audio':
                outputOptions = ['-c:a', 'aac', '-b:a', '192k'];
                break;
            case 'image':
                outputOptions = ['-quality', '90'];
                break;
        }

        // Выполняем конвертацию
        await ffmpeg.run('-i', inputFileName, ...outputOptions, outputFileName);

        // Читаем результат
        const data = ffmpeg.FS('readFile', outputFileName);

        // Очищаем файлы
        ffmpeg.FS('unlink', inputFileName);
        ffmpeg.FS('unlink', outputFileName);

        // Определяем MIME-тип для выходного файла
        const mimeType = getMimeType(targetFormat);
        
        return new Blob([data.buffer], { type: mimeType });
    } catch (error) {
        console.error('Ошибка конвертации:', error);
        throw new Error(`Ошибка конвертации: ${error.message}`);
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
    // Создаем имя файла
    const originalName = originalFileName.split('.')[0];
    const fileName = `${originalName}_converted.${targetFormat}`;
    
    // Создаем ссылку для скачивания
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    
    // Добавляем элемент на страницу
    document.body.appendChild(a);
    
    // Эмулируем клик
    a.click();
    
    // Удаляем элемент и освобождаем URL
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
    
    // Показываем сообщение об успехе
    showSuccessMessage(`Файл ${fileName} успешно сохранен`);
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
