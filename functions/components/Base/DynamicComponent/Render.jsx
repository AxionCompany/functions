import { lazy as dynamic } from "react";

const getComponent = (c) => dynamic(() => {
    c = c.split('/')
    return import(`components/${c[1]}/${c[2]}/${c[3]}`)
});


export default getComponent;

