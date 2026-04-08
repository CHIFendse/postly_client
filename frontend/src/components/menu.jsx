import {useState, useEffect} from 'react'
import './menu.css'
import groups from '../assets/images/users.svg'

function Menu() {

    return (
        <div className='menu'>
            <p>{'ВНЕШНЕЕ МЕНЮ'}</p>
            <button>
                <img
                src={groups}
                />
            </button>
        </div>
    )
}

export default Menu;