import './mainHeader.css'

function MainHeader({handleLogout, username}){
    
    return (
            <header className="main-header">
                <nav className="preview">
                    <span>POSTLY</span>
                </nav>
                <div className='right-group'>
                    <nav className='username'>{username}</nav>
                    <button className='btn-exit' onClick={handleLogout}>Выйти</button>
                </div>
            </header>
        );
};

export default MainHeader;