import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useGlobal } from "../../global/Context"
import { useAuth } from "../../global/AuthContext"
import { MdEdit } from "react-icons/md"
import { IoMenuOutline } from 'react-icons/io5'
import { AppRoutes } from "../../routes/path"
import Header from "../../components/Header"
import { Container, NavigationMenu, NavigationMenu_rightSide } from "./styled"
import { authService } from "../../services/auth"
import { formatPhoneNumber } from "../../utils/inputsAndKeys"




const Profile = ()=>{
    const navigate = useNavigate()
    const { user, getProfile } = useGlobal()
    const { logout } = useAuth()
    const token = localStorage.getItem('token')
    const [isNavigationOpen, setIsNavigationOpen] = useState<boolean>(false)
    const [isNavigation_rigstSideOpen, setIsNavigation_rightSideOpen] = useState<boolean>(false)


    useEffect(()=>{
        if(!token){
            navigate('/', { replace: true })
        }else{
            getProfile()
        }
    }, [token, navigate, getProfile])


    const handleLogout = ()=>{
        const confirmLogout = window.confirm('Tem certeza que quer sair da sua conta?')
        if(confirmLogout){
            logout()
            navigate('/', { replace: true })
        }
    }


    const handleDeleteAccount = async()=>{
        const confirmDelete = window.confirm('Tem certeza que quer deletar sua conta? Essa acção não pode ser desfeita.')
        if(!confirmDelete) return
        try{
            await authService.deleteAccount()
            localStorage.clear()
            navigate('/', { replace: true })
        }catch(e:any){
            alert(e?.response?.data?.message || e?.response?.data || 'Um erro ocorreu ao tentar deletar sua conta.')
        }
    }       
        



    return(
        <>
            <Header
                leftIcon={
                    <NavigationMenu>
                        <button
                            type='button'
                            className='menu-trigger'
                            aria-label='Open Navigation options'
                            aria-expanded={isNavigationOpen}
                            aria-controls='detail-navigation'
                            onClick={() => setIsNavigationOpen((isOpen) => !isOpen)}
                        >
                            <IoMenuOutline className='header-icon'/>
                        </button>
                        {isNavigationOpen && (
                            <nav id="detail-navigation" aria-label='Screen navigation'>
                                <button
                                    type='button'
                                    onClick={()=>{
                                        setIsNavigationOpen(false)
                                        navigate(AppRoutes.DETAIL)
                                    }}
                                >
                                    Provedor
                                </button>

                                <button
                                    type='button'
                                    onClick={()=>{
                                        setIsNavigationOpen(false)
                                        navigate(AppRoutes.CART)
                                    }}
                                >
                                    Carrinho
                                </button>
                            </nav>
                        )}
                    </NavigationMenu>
                }
                rightIcon={
                    <NavigationMenu_rightSide>
                        <button
                            type='button'
                            className='menu-trigger'
                            aria-label='Open Navigation options'
                            aria-expanded={isNavigation_rigstSideOpen}
                            aria-controls='detail-navigation'
                            onClick={() => setIsNavigation_rightSideOpen((isOpen) => !isOpen)}
                        >
                            <IoMenuOutline className='header-icon'/>
                        </button>
                        {isNavigation_rigstSideOpen && (
                            <nav id="detail-navigation" aria-label='Screen navigation'>
                                <button
                                    type='button'
                                    onClick={()=>{
                                        setIsNavigation_rightSideOpen(false)
                                        navigate(AppRoutes.HOME)
                                    }}
                                >
                                    Home
                                </button>

                                <button
                                    type='button'
                                    onClick={()=>{
                                        setIsNavigationOpen(false)
                                        handleLogout()
                                    }}
                                >
                                    Deslogar
                                </button>
                            </nav>
                        )}
                    </NavigationMenu_rightSide>
                }
            />
            <Container>
                <h1>Perfil do Usuário</h1>
                <hr style={{ width: '100%', marginBottom: '15px', backgroundColor: 'lightgray', border: 'none', height: '1px' }} />

                <div className="user-section">
                    <div>
                        <span className="properties">Nome:</span> {user.username} <br />
                        <span className="properties">Email:</span> {user.email} <br />
                        <span className="properties">Telefone:</span> {formatPhoneNumber(user.phone)}
                    </div>
                    <MdEdit className="icon" onClick={() => navigate('/edit-profile')} />
                </div>
                <div className="address-section">
                    <div style={{ width: '100%' }}>
                        <div className="registered-address">Endereço cadastrado:</div>
                        <div style={{ maxWidth: '90%' }}>
                            <span className="properties">Local:</span> {user.street}, {user.number || 'S/N'} <br />
                            <span className="properties">Bairro:</span> {user.neighbourhood} <br />
                            <span className="properties">Cidade/Estado:</span> {user.city} - {user.state} <br />
                            <span className="properties">CEP:</span> {user.cep}
                        </div>
                    </div>
                    <MdEdit 
                        className="icon" 
                        onClick={() => navigate(AppRoutes.ADDRESS, { state: { mode: 'update' } })}
                    />
                </div>

                <div className="danger-zone">
                    <button
                        type="button"
                        className="btn-delete-subtle"
                        onClick={handleDeleteAccount}>
                        Delete Account
                    </button>
                </div>    
            </Container>
        </>
    )    
}


export default Profile