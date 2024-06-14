
import Divider from "../../Base/Divider/main.jsx";
import { Row } from "../../Base/Grid/main.js";
import { Button } from "../../Base/Button/main.js";

export default function ListPageHeader({ title, filters, createButton, children, onCreate, removeDivider, ...props }) {
    return (
        <>
            <Row className="justify-between items-end">
                {children}
                {createButton &&
                    <Button className="w-96" onClick={onCreate}>{createButton}</Button>
                }
            </Row>
            {!removeDivider 
                ? <Divider />
                : <div className="mt-6" />
            }
        </>
    );
}

