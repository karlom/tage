/**
 * 文件格式服务
 * 根据模型能力动态决定支持的文件格式
 */

import { type ModelCapabilities } from './storage';

// 文件类别
export type FileCategory = 'image' | 'audio' | 'video' | 'document';

// 文件格式定义
export interface FileFormat {
    extension: string;
    mimeType: string;
    category: FileCategory;
    // 需要的模型能力
    requiredCapability: keyof ModelCapabilities;
    // 是否需要解析（文档类型需要提取文本）
    requiresParsing?: boolean;
}

// 对话框文件过滤器类型（兼容 Electron）
export interface DialogFileFilter {
    name: string;
    extensions: string[];
}

// 所有支持的文件格式
export const ALL_FILE_FORMATS: FileFormat[] = [
    // 图片格式
    { extension: 'jpg', mimeType: 'image/jpeg', category: 'image', requiredCapability: 'vision' },
    { extension: 'jpeg', mimeType: 'image/jpeg', category: 'image', requiredCapability: 'vision' },
    { extension: 'png', mimeType: 'image/png', category: 'image', requiredCapability: 'vision' },
    { extension: 'gif', mimeType: 'image/gif', category: 'image', requiredCapability: 'vision' },
    { extension: 'webp', mimeType: 'image/webp', category: 'image', requiredCapability: 'vision' },
    { extension: 'heic', mimeType: 'image/heic', category: 'image', requiredCapability: 'vision' },
    { extension: 'heif', mimeType: 'image/heif', category: 'image', requiredCapability: 'vision' },

    // 音频格式
    { extension: 'mp3', mimeType: 'audio/mpeg', category: 'audio', requiredCapability: 'audio' },
    { extension: 'wav', mimeType: 'audio/wav', category: 'audio', requiredCapability: 'audio' },
    { extension: 'm4a', mimeType: 'audio/m4a', category: 'audio', requiredCapability: 'audio' },
    { extension: 'flac', mimeType: 'audio/flac', category: 'audio', requiredCapability: 'audio' },
    { extension: 'aac', mimeType: 'audio/aac', category: 'audio', requiredCapability: 'audio' },
    { extension: 'ogg', mimeType: 'audio/ogg', category: 'audio', requiredCapability: 'audio' },
    { extension: 'opus', mimeType: 'audio/opus', category: 'audio', requiredCapability: 'audio' },

    // 视频格式
    { extension: 'mp4', mimeType: 'video/mp4', category: 'video', requiredCapability: 'video' },
    { extension: 'webm', mimeType: 'video/webm', category: 'video', requiredCapability: 'video' },
    { extension: 'mov', mimeType: 'video/quicktime', category: 'video', requiredCapability: 'video' },
    { extension: 'mpeg', mimeType: 'video/mpeg', category: 'video', requiredCapability: 'video' },
    { extension: 'avi', mimeType: 'video/x-msvideo', category: 'video', requiredCapability: 'video' },

    // 文档格式（需要文本提取）
    { extension: 'pdf', mimeType: 'application/pdf', category: 'document', requiredCapability: 'documents', requiresParsing: true },
    { extension: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', category: 'document', requiredCapability: 'documents', requiresParsing: true },
    { extension: 'doc', mimeType: 'application/msword', category: 'document', requiredCapability: 'documents', requiresParsing: true },
    { extension: 'txt', mimeType: 'text/plain', category: 'document', requiredCapability: 'documents', requiresParsing: true },
    { extension: 'md', mimeType: 'text/markdown', category: 'document', requiredCapability: 'documents', requiresParsing: true },
    { extension: 'csv', mimeType: 'text/csv', category: 'document', requiredCapability: 'documents', requiresParsing: true },
];

// 类别显示名称
export const CATEGORY_LABELS: Record<FileCategory, string> = {
    image: '图片',
    audio: '音频',
    video: '视频',
    document: '文档',
};

/**
 * 根据模型能力获取支持的文件格式
 */
export function getSupportedFormats(capabilities?: ModelCapabilities): FileFormat[] {
    if (!capabilities) {
        // 如果没有能力信息，默认只支持文档（通过文本提取）
        return ALL_FILE_FORMATS.filter(f => f.category === 'document');
    }

    return ALL_FILE_FORMATS.filter(format => {
        const cap = format.requiredCapability;
        return capabilities[cap] === true;
    });
}

/**
 * 根据模型能力获取支持的文件扩展名
 */
export function getSupportedExtensions(capabilities?: ModelCapabilities): string[] {
    const formats = getSupportedFormats(capabilities);
    return formats.map(f => f.extension);
}

/**
 * 根据模型能力生成文件对话框的过滤器
 */
export function getFileFilters(capabilities?: ModelCapabilities): DialogFileFilter[] {
    const formats = getSupportedFormats(capabilities);
    const filters: DialogFileFilter[] = [];

    // 按类别分组
    const categories = new Map<FileCategory, string[]>();
    for (const format of formats) {
        if (!categories.has(format.category)) {
            categories.set(format.category, []);
        }
        categories.get(format.category)!.push(format.extension);
    }

    // 生成每个类别的过滤器
    for (const [category, extensions] of categories) {
        filters.push({
            name: CATEGORY_LABELS[category],
            extensions,
        });
    }

    // 添加"所有支持的格式"选项
    if (filters.length > 1) {
        const allExtensions = formats.map(f => f.extension);
        filters.unshift({
            name: '所有支持的格式',
            extensions: allExtensions,
        });
    }

    return filters;
}

/**
 * 检查附件是否被模型支持
 */
export function isFormatSupported(
    extension: string,
    capabilities?: ModelCapabilities
): boolean {
    const supportedFormats = getSupportedFormats(capabilities);
    return supportedFormats.some(f => f.extension.toLowerCase() === extension.toLowerCase());
}

/**
 * 根据扩展名获取文件格式信息
 */
export function getFormatByExtension(extension: string): FileFormat | undefined {
    return ALL_FILE_FORMATS.find(f => f.extension.toLowerCase() === extension.toLowerCase());
}

/**
 * 根据扩展名获取 MIME 类型
 */
export function getMimeTypeByExtension(extension: string): string {
    const format = getFormatByExtension(extension);
    return format?.mimeType || 'application/octet-stream';
}

/**
 * 检查文件是否需要解析（提取文本内容）
 */
export function requiresParsing(extension: string): boolean {
    const format = getFormatByExtension(extension);
    return format?.requiresParsing === true;
}

/**
 * 获取模型支持的能力摘要（用于显示）
 */
export function getCapabilitySummary(capabilities?: ModelCapabilities): string[] {
    const summary: string[] = [];
    if (capabilities?.vision) summary.push('图片');
    if (capabilities?.audio) summary.push('音频');
    if (capabilities?.video) summary.push('视频');
    if (capabilities?.documents) summary.push('文档');
    return summary;
}
