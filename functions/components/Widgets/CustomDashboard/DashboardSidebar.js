import React, { useState, useEffect } from 'react'
import { Row, Col } from 'components/Base/Grid'
import { MenuButton } from 'components/Base/Button'

function DashboardSidebar ({ children, selectedTab }) {
  const [childrenKey, setChildrenKey] = useState(0)

  useEffect(() => {
    setChildrenKey(selectedTab)
  }, [selectedTab])
  
  return (
    <Row className="min-w-full">
      <Col className="
        hidden
        bg-base-100
        min-w-[228px]
        h-full
        pb-4
        justify-between
        md:flex
      ">
        <nav className="
          menu
          menu-compact
          flex
          flex-col
          active
        ">
          {children.length > 1 && 
            children.map((item, index) => {
              return item.props.type === "item" ? (
                <MenuButton
                  key={index}
                  onClick={item.props.onClick}
                  selected={index === childrenKey}
                  className="items-center justify-start cursor-pointer"
                >
                  <span
                    className={`text-sm font-light
                      ${index === childrenKey ? 'text-white' : 'text-black'}
                    `}
                  >
                    {item.props.title}
                  </span>
                </MenuButton>
              ) : (
                <span className="mb-3 mt-5 text-base font-medium">
                  {item.props.title}
                </span>
              )
            })
          }
        </nav>
      </Col>
      <Col className="ml-10 pt-5 pb-4">
        {children[childrenKey]}
      </Col>
    </Row>
  )
} 

export default DashboardSidebar