import { Col, Row } from 'components/Base/Grid';
import Icon from 'components/Base/Icon';
import MenuButton from 'components/Base/Button/MenuButton';

const SidebarFooter = ({ userName, handleClickProfile, goToProfileText, isOpen, hasProfile }) => {
    if (!(hasProfile === undefined) && !hasProfile) {
        return (
            <>
                {isOpen &&
                    <Row className="items-end">
                        <a href='https://axion.company/' className="ml-1"><span className="text-sm">Desenvolvido por <span className="font-extrabold">AXION</span></span></a>
                    </Row>
                }
            </>
        )
    } else {
        return (
            <MenuButton onClick={handleClickProfile} className="flex flex-row py-2 hover:bg-base-300 rounded-lg items-center">
                <Col>
                    <Icon size={"24px"} iconName={"HiOutlineUserCircle"} />
                </Col>
                {isOpen &&
                    <Col className="ml-4">
                        <span className="font-medium text-sm">{userName}</span>
                        <span className="font-light text-xs" href="/perfil">
                            {goToProfileText}
                        </span>
                    </Col>
                }
    
            </MenuButton>
        )
    }
}

export default SidebarFooter;