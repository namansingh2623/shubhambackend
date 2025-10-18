// utils/markdown.js
const DOMPurify = require('isomorphic-dompurify');

async function markdownToHtml(markdownText) {
    if (!markdownText) return '';
    const { marked } = await import('marked'); // ✅ dynamic import for ESM
    const rawHtml = marked.parse(markdownText);
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    return cleanHtml;
}

function mdToSafeHtml(markdownText) {
    if (!markdownText) return '';
    const { marked } = require('marked');
    const rawHtml = marked.parse(markdownText);
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    return cleanHtml;
}

function estimateReadingTime(text) {
    const wordsPerMinute = 200;
    const words = text.trim().split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
}

module.exports = { markdownToHtml, mdToSafeHtml, estimateReadingTime };