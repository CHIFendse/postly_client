import './menu.css'
import groupsIcon from '../assets/images/users.svg'

function Menu({ setView }) {
    return (
        <div className='menu'>

            {/* Кнопка Групп */}
            <button className="groups-button" onClick={() => setView('groups')}>
                <img src={groupsIcon} className="groupsIcon" alt="groups" />
            </button>
        </div>
    )
}
export default Menu;
