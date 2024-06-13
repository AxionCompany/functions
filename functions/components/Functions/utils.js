
export const dataToArray = (data) => {
    const keys = Object.keys(data[0]);
    const result = [keys];

    for (let i = 0; i < data.length; i++) {
        const values = Object.values(data[i]);
        result.push(values);
    }

    return result;
}

export const toTitleCase = (str) => {
    return str.replace(/([A-Z])/g, ' $1').replace(/^./, function (str) { return str.toUpperCase(); })
};
