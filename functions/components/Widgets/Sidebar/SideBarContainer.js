
import { useEffect, useState } from "react";

import { Col } from "components/Base/Grid";
import { MenuButton } from "components/Base/Button"
import Icon from "components/Base/Icon";
import SidebarHeader from "./SidebarHeader";
import SidebarFooter from "./SidebarFooter";

const defaultProps = {
    currentPage: '/',
    menuItems: [
        {
            name: "Componentes",
            url: "/axion-components",
            icon: "HiOutlineDocumentDuplicate",
            type: "item",
        },
        {
            name: "Teste",
            url: "/axion-components",
            icon: "HiOutlineDocumentDuplicate",
            type: "subitem",
        }
    ],
    handlePageChange: () => { }
}


const SideBar = ({ children, handlePageChange, currentPage, className, menuItems, LogoComponent, onSignOut, profilePath, defaultIsOpen, user, projectVersion, headerChildren, hasProfile, allowClose, ...props } = defaultProps) => {
    user = user || {}
    user.name = user.name || 'Eduardo Pereira';
    profilePath = profilePath || '/users/profile';

    const [isOpen, setIsOpen] = useState(!defaultIsOpen);

    useEffect(() => {
        setIsOpen(!isOpen)
    }, [defaultIsOpen])

    const handleHide = () => {
        setIsOpen(!isOpen)
    }

    return (
        <div style={{ zIndex: 10000 }} className={`${isOpen ? 'fixed' : 'hidden'} md:relative bg-base-100 ${allowClose && 'min-w-fit'} ${isOpen ? 'w-80' : 'w-24'} h-screen py-4 px-4 flex flex-col justify-between shadow-lg ${className} md:flex`}>
            <div>
                <SidebarHeader LogoComponent={LogoComponent} handleHide={handleHide} isOpen={isOpen} allowClose={allowClose}>
                    {headerChildren}
                </SidebarHeader>
                <nav className="menu menu-compact flex flex-col active">
                    {menuItems.map(({ name, url, icon, type }, index) => {
                        return (
                            type === "subitem" ?
                                isOpen &&
                                <MenuButton
                                    key={index}
                                    onClick={() => handlePageChange(url)}
                                    selected={url === currentPage ? true : false}
                                    className="items-center justify-start">
                                    <span className={`ml-4 font-light text-sm`}>{name}</span>
                                </MenuButton>
                                :
                                <MenuButton
                                    key={index}
                                    onClick={() => handlePageChange(url)}
                                    selected={url === currentPage ? true : false}
                                    className={`items-center justify-start`}>
                                    <Icon size={"18px"} iconName={icon} />
                                    {isOpen && <span style={{display: "inline-flex", minWidth: "max-content"}} className={`ml-4 font-medium text-sm `}>{name}</span>}
                                </MenuButton>
                        );
                    })}
                </nav>
            </div>
            <Col>
                {projectVersion && isOpen && (
                    <>
                        <div className="flex flex-row px-4 py-2 items-center text-zinc-400">
                            <Icon size={"18px"} iconName={"HiOutlineHashtag"} />
                            <span className={`ml-4 font-light`}>
                                Versão: {projectVersion}
                            </span>
                        </div>
                        <div className="divider"></div>
                    </>
                )}
                {!(hasProfile === undefined) && !hasProfile ? <></> :
                    <>
                        <MenuButton onClick={onSignOut} className="items-center">
                            <Icon size={"18px"} iconName={"HiOutlineArrowLeft"} />
                            {isOpen && <span className={`ml-4 font-light`}>Sair do sistema</span>}
                        </MenuButton>
                        <div className="divider"></div>
                    </>
                }
                <SidebarFooter
                    userName={user?.name}
                    handleClickProfile={() => handlePageChange(profilePath)}
                    goToProfileText="Ver meu perfil"
                    isOpen={isOpen}
                    hasProfile={hasProfile}
                />
            </Col>
        </div>
    )
};

export default SideBar;
