function replaceTemplate(template: string, data: Record<string, string>) {
    return template.replace(/\{\{(\w+)\}\}/g, function (match, key) {
        return data[key] || '';
    });
}
export default replaceTemplate;