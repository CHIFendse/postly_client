import './header.css';
import decall from '../assets/images/phone-line.png';
import callIcon from '../assets/images/phone-fill.png';
import { useCall } from '../call/CallProvider';

const CALL_STATUS = {
    outgoing: 'Звоним...',
    connecting: 'Соединение...',
    active: 'В разговоре',
};

function Header({
    chatName,
    chatId,
    chatUserId,
    onMenuToggle,
    onProfileToggle
}) {
    const { call, startCall, hangup } = useCall();

    const inCall = Boolean(call && call.state !== 'ended' && call.state !== 'incoming');
    const inThisChat = inCall && call.chatId === String(chatId);
    const busyElsewhere = inCall && !inThisChat;

    const handleCallClick = () => {
        if (inThisChat) {
            hangup();
            return;
        }
        if (busyElsewhere || !chatId) return;
        startCall(String(chatId), chatName, chatUserId ? 'direct' : 'group');
    };

    const handleMenuClick = (e) => {
        e.stopPropagation();
        if (onMenuToggle) {
            onMenuToggle();
        }
    };

    const handleProfileClick = (e) => {
        e.stopPropagation();
        if (onProfileToggle) {
            onProfileToggle();
        }
    };

    if (!chatId) {
        return (
            <header className="header">
                <div className="left-group">
                    <button
                        className="menu-toggle-btn"
                        onClick={handleMenuClick}
                        type="button"
                    >
                        ☰
                    </button>
                </div>
            </header>
        );
    }

    return (
        <header className="header">
            <div className="left-group">
                <button
                    className="menu-toggle-btn"
                    onClick={handleMenuClick}
                    type="button"
                >
                    ☰
                </button>

                <button
                    className="chat-name"
                    onClick={handleProfileClick}
                    type="button"
                >
                    {chatName}
                </button>
            </div>

            <div className="header-right">
                {inThisChat && (
                    <span className="status-text">
                        {CALL_STATUS[call.state]}
                    </span>
                )}

                <button
                    className={`call-button ${inThisChat ? 'connected' : 'disconnected'}`}
                    onClick={handleCallClick}
                    disabled={busyElsewhere}
                    title={
                        inThisChat
                            ? 'Завершить звонок'
                            : busyElsewhere
                                ? 'Идёт другой звонок'
                                : 'Позвонить'
                    }
                    type="button"
                >
                    <img
                        src={inThisChat ? decall : callIcon}
                        alt={inThisChat ? 'Hang Up' : 'Call'}
                        className="button-icon"
                    />
                </button>
            </div>
        </header>
    );
}

export default Header;
