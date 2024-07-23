function replaceTemplate(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, function (match, key) {
        return data[key] || '';
    });
}
export default replaceTemplate;