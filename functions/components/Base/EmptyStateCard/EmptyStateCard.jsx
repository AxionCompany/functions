import Icon from '../Icon/main.jsx'

function EmptyStateCard () {
  return (
    <div style={{height: "30vw"}} className="min-w-full items-center justify-center flex flex-col">
      <Icon 
        size={"80px"}
        iconName={"HiSearch"}
        color={"#C9C9C9"}
      />
      <span className="text-center text-lg font-normal text-[#C9C9C9] mt-4">Nenhum resultado encontrado.</span>
    </div>
  )
}

export default EmptyStateCard