export default (adapters: any) => async (props: any) => {
    let content = "";
    try{
        content = fs.readFileSync("/myFile.txt", "utf8");
    } catch(err){
        console.log(err)
    }
  fs.writeFileSync("/myFile.txt", `${content}\n${JSON.stringify(props)}`);
  const newContent = fs.readFileSync("/myFile.txt", "utf8");
  console.log(content); // Outputs: Hello, world!

  return { ...props, content:newContent };
};
