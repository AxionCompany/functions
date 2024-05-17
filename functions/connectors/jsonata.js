import jsonata from 'npm:jsonata';

export default async (expression, data) => {
    const compiled = jsonata(expression);
    const result = await compiled.evaluate(data);
    return result
}