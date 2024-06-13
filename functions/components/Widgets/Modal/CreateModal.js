import React, { useState, useEffect } from 'react'
import { Form, FormActions, FormSection } from '../Form'
import { LabeledInput } from '../Input';
import { Row, Col } from '../Grid';

export default function CreateModal({ modalId, modalTitle }) {
    const [formData, setFormData] = useState();

    return (
        <>
            <input type="checkbox" id={modalId} className="modal-toggle" />
            <label for={modalId} className="modal cursor-pointer">
                <label className="modal-box relative" for="">
                    <Row className="justify-between mb-6">
                        <span className="text-2xl text-[#1A2519] font-bold">{modalTitle}</span>
                        <label for={modalId} className="btn btn-primary btn-sm btn-circle text-white">✕</label>
                    </Row>
                    <Form onSubmit={setFormData}>
                        <Col className="mb-10">
                            <LabeledInput
                                className="max-w-[464px] mr-6" required={true}
                                label="Nome" name="name" />
                            <LabeledInput
                                className="max-w-[464px]" required={true}
                                label="Email" name="email" />
                        </Col>
                        <FormActions
                            submitButton={"CRIAR USUÁRIO"}
                            submitBtnSize={"w-full"} />
                    </Form>
                </label>
            </label>
        </>
    )
}