import Select, { components } from 'npm:react-select'
import { Col } from '../Grid/main.js'
import Icon from '../Icon/main.jsx'

const Option = (props) => {
  console.log('OPTION PROPS',props)
  return (
    <div className={"z-10"}>
      <components.Option {...props}>
        <input 
          type='checkbox'
          checked={props.isSelected}
          onChange={() => null}
          disabled={true}
        />{" "}
        <label className='ml-4'>{props.data.name}</label>
      </components.Option>
    </div>
  )
}

const MultiValue = (props) => {
  return (
    <div className={"z-10"}>
      <components.MultiValue {...props}>
        <span>{props.data.name}</span>
      </components.MultiValue>
    </div>
  )
}

const DropdownIndicator = (props) => {
  return (
    <components.DropdownIndicator {...props}>
      <Col className={"h-[30px] w-6 items-center justify-center"}>
        <Icon size={"12px"} color={"#000"} iconName={"HiChevronDown"}/>
      </Col>
    </components.DropdownIndicator>
  )
}

const SelectContainer = ({
  children,
  ...props
}) => {
  return (
    <div className={"z-10"}>
      <components.SelectContainer {...props}>
        {children}
      </components.SelectContainer>
    </div>
  )
}

const MultiSelect = ({
  label,
  requiredLabel,
  options,
  placeholder,
  onChange,
  className,
  ...props
}) => {
  const handleSelect = (e) => {
    return onChange(e)
  }

  return (
    <div className={`form-control align-top w-full max-w-[336px] ${className}`}>
      <label className="label">
        <span className="label-text">
          {label}
          <span className="ml-4 text-zinc-400 text-xs">{requiredLabel}</span>
        </span>
      </label>
      <Select 
        options={options}
        isMulti
        closeMenuOnSelect={false}
        hideSelectedOptions={true}
        allowSelectAll={true}
        placeholder={placeholder}
        components={{
          Option,
          MultiValue,
          DropdownIndicator,
          SelectContainer
        }}
        onChange={option => {
          handleSelect(option)
        }}
        styles={{
          container: (base) => ({
            ...base
          })
        }}
        {...props}
      />
    </div>
  )
}

export default MultiSelect