import { Row } from 'components/Base/Grid';
import Logo from 'components/Widgets/Logo';
import MenuButton from 'components/Base/Button/MenuButton';
import Icon from 'components/Base/Icon';

const SidebarHeader = ({ handleHide, isOpen, LogoComponent, children, allowClose }) => {
    return (
        <>
        <Row className="mb-7 justify-between items-center">
            {isOpen && (LogoComponent ? <LogoComponent /> : <Logo />)}
            {!(allowClose === undefined) && !allowClose ? <></> :
                <MenuButton
                    onClick={handleHide}
                    className={isOpen ? "" : ""}
                >
                    <Icon
                        size={"18px"}
                        iconName={isOpen ?
                            "HiOutlineChevronDoubleLeft"
                            : "HiOutlineChevronDoubleRight"}
                        color={"#C4C4C4"} />
                </MenuButton>
            }
        </Row>
        {isOpen && children}
        </>
    )
}

export default SidebarHeader;