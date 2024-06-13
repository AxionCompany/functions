import React from 'react'
import { Row } from '../Grid'
import Icon from '../Icon'

const ConfirmModal = ({ label, name, description, btnTxtConfirm, onConfirm }) => {
  const txtConfirm = btnTxtConfirm || "Deletar"

  return (
    <div>
      <input type="checkbox" id={name} className="modal-toggle" />
      <label htmlFor={name} className="modal">
        <div className="modal-box min-w-min">
          <Row className="justify-between">
            <h3 className="font-bold text-lg">{label}</h3>
            <label htmlFor={name} className="cursor-pointer">
              <Icon 
                color={"#000"}
                size={24}
                iconName={"HiOutlineX"}
                classes={"cursor-pointer"}
              />
            </label>
          </Row>

          {description && <Row className="mt-4">{description}</Row>}

          <Row className="mt-6 justify-between flex-nowrap">
            <label
              className={"btn min-w-7r btn-outline bg-white text-primary hover:bg-base-300 hover:text-primary"}
							htmlFor={name}
            >
              <span className="test-sm font-medium">Cancelar</span>
            </label>
            <label
              onClick={() => onConfirm()}
              htmlFor={name}
              className={`btn min-w-7r btn-outline ml-6 bg-primary text-white hover:bg-primary-focus`}
            >
              {txtConfirm}
            </label>
          </Row>
        </div>
      </label>
    </div>
  )
}

export default ConfirmModal