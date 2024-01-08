export default (str: any) => {
  try {
    return JSON.parse(str);
  } catch (err) {
    return str;
  }
};