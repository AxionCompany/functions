import React, { useState, useEffect } from 'react'
import { LabeledInput } from 'components/Base/Input';
import { Row } from 'components/Base/Grid';

import { Form, FormActions } from 'components/Base/Form';
import Icon from 'components/Base/Icon';

export default function PasswordModal({ modalId, modalTitle, user, server, router, ...props }) {
    const { showAlert } = props;
    const [password, setPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    function clearPasswords() {
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");
    }

    async function updatePassword(data) {
        try {
            data.password = password;
            data.newPassword = newPassword;
            data.confirmPassword = confirmPassword;

            if (!password) {
                throw new Error("Campo senha inválido.");
            }

            if (newPassword.length < 6) {
                throw new Error("A senha deve conter mais de 6 dígitos.");
            }

            if (newPassword !== confirmPassword) {
                throw new Error("Senha e confirmação de senha devem ser iguais.");
            }

            const updatePassword = await server.put(
                "/users/password",
                { email: user.email, password: data.password, newPassword: data.newPassword }
            )

            if (updatePassword.status === 200) {
                showAlert({ message: "Senha alterada com sucesso!", type: "success" });

                delete data.password;
                delete data.newPassword;
                delete data.confirmPassword;
                clearPasswords();

                router.push("/users")
            }
        } catch (err) {
            showAlert({ message: err.message, type: "error" });
        }
    }

    return (
        <>
            <input type="checkbox" id={modalId} className="modal-toggle" />
            <label htmlFor={modalId} className="modal cursor-pointer">
                <label className="modal-box relative">
                    <Row className="justify-between mb-6">
                        <span className="text-2xl text-[#1A2519] font-bold">{modalTitle}</span>
                        <label htmlFor={modalId} className="cursor-pointer items-center flex">
                            <Icon iconName="HiOutlineX" size="20px" color="black" />
                        </label>
                    </Row>
                    <Form onSubmit={updatePassword}>
                        <LabeledInput
                            className="max-w-[464px]"
                            required={true}
                            type="password"
                            label="Senha atual"
                            onChange={(e) => setPassword(e.target.value)}
                            value={password}
                        />
                        <LabeledInput
                            className="max-w-[464px]"
                            required={true}
                            type="password"
                            label="Nova senha"
                            onChange={(e) => setNewPassword(e.target.value)}
                            value={newPassword}
                        />
                        <LabeledInput
                            className="max-w-[464px]"
                            required={true}
                            type="password"
                            label="Confirmar senha"
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            value={confirmPassword}
                        />
                        <FormActions
                            submitButton={"SALVAR"}
                            submitStyle={"w-[45%]"}
                            cancelButton={(
                                <label htmlFor={modalId} className="cursor-pointer">
                                    <span>VOLTAR</span>
                                </label>
                            )}
                            cancelAction={() => clearPasswords()}
                            cancelStyle={"w-[45%]"}
                        />
                    </Form>
                </label>
            </label>
        </>
    )
}