export default (config: any) =>
async (
  {
    url,
    method,
    data,
    timeout,
    headers,
    responseHeaders,
    mode,
    type = "default",
  }: any,
) => {
  const body = JSON.stringify({
    url,
    method,
    postData: data,
    headers,
    responseHeaders,
    mode,
  });
  const options = { timeout };
  const urlScrapper =
    `https://us-central1-scrapper-homolog.cloudfunctions.net/${type} `;

  try {

    
    const result = await fetch(urlScrapper, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      ...options,
    })
      .then((res) => res.json())
      .catch((err) => console.log(err));

      console.log('result', body, result)

    return result;
  } catch (error) {
    console.log(error.msg);
    return error.message;
  }
};
