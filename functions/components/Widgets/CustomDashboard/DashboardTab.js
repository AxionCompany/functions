import React from 'react'

//Must receive a title, a type (item or title) and a function onClick
function DashboardTab({ children }) {
  return(
    <div>
      {children}
    </div>
  )
}

export default DashboardTab