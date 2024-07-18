import {Button} from "axion-components/Base/Button";
import React, {useState} from "react";

export default ()=>'Welcome to Axion Functions 3!';

export const GET = () =>{
    const [count, setCount] = useState(0);
    return (
        <>
            <Button onClick={() => setCount(count + 1)} >
                Clicked me {count} times. Just changed 2
            </Button>
        </>
    )
}
