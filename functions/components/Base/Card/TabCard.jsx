export default function TabCard ({ title, description, selected, onClick }) {
  return(
    <div className={`w-full pl-4 ${!selected && "px-4"}`}>
      <div className={`flex flex-col p-4 justify-center bg-white cursor-pointer shadow-lg ${selected && "border-l-4 border-primary"}`} onClick={() => {onClick()}}>
        <span className={`font-bold text-black mt-2`}>{title}</span>
        <span className={`text-gray-400 mb-2`}>{description}</span>
      </div>
    </div>
  )
}