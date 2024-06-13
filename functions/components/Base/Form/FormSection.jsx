import { Row, Col } from "../Grid/main.js";

const FormSection = ({ sectionTitle, sectionDescription, children, control, errors }) => {
    return (
        <Row className="grid md:grid-cols-3 my-5 flex-wrap">
            <Col className="flex flex-col my-5 ">
                <span className="text-sm font-semibold mb-4 text-zinc-700">
                    {sectionTitle}
                </span>
                <span className="text-sm text-slate-500">
                    {sectionDescription}
                </span>
            </Col>
            <Col className="grid md:col-span-2 my-5">
                {children}
            </Col >
        </Row >
    )
}

export default FormSection