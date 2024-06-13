import Divider from 'components/Base/Divider'
import { Col, Row } from 'components/Base/Grid'
import Icon from 'components/Base/Icon'
import React from 'react'

function InstructionsCard({ title, info, type }) {
  return (
    <div style={{ width: "50vw" }}>
      <Row className={'gap-6 items-center'}>
        {type === "info"  && (
          <Icon 
            iconName="HiInformationCircle"
            size="64px"
            color="#C9C9C9"
          />
        )}
        {type === "error" && (
          <Icon 
            iconName="HiExclamationCircle"
            size="64px"
            color="#C9C9C9"
          />
        )}
        <span className="text-2xl font-medium">{title}</span>
      </Row>
      <Divider />
      <Col>
        <span className='text-base font-normal ml-[88px]'>{info}</span>
      </Col>
    </div>
  )
}

export default InstructionsCard