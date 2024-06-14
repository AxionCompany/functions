
import { Row } from "components/Base/Grid";
import { MenuIconButton } from "components/Base/Button";
import Divider from "components/Base/Divider";

const CreatePageHeader = ({ onGoBack, createdAt, createdBy, children }) => {
    return (
        <>
            <Row className="flex flex-row justify-between items-center">
                <div>
                    <MenuIconButton
                        icon="HiOutlineArrowLeft"
                        onClick={onGoBack}
                        label="VOLTAR"
                        labelClassName="text-xs text-zinc-700"
                        iconColor="#3f3f46"
                        iconSize={"14px"}
                    />
                </div>
                <div>
                    {(!!createdAt || !!createdBy) && (
                        <span className="text-xs font-light text-stone-400">Criado </span>
                    )}
                    {createdAt !== undefined && (
                        <span className="text-xs font-light text-stone-400">
                            em {createdAt}
                        </span>
                    )}
                    {createdBy !== undefined && (
                        <span className="text-xs font-light text-stone-400">
                            por {createdBy}
                        </span>
                    )}
                    {!!children && children}
                </div>
            </Row>
            <Divider />
        </>
    );
};

export default CreatePageHeader;
