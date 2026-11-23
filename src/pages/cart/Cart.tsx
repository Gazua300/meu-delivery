import { type ChangeEvent, type FC, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { useGlobal } from "../../global/Context"
import { IoPersonOutline, IoMenuOutline } from "react-icons/io5"
import { MdEdit } from 'react-icons/md'
import Header from "../../components/Header"
import MpModal from "../../components/MpModal" // Restored target modal
import { Container, NavigationMenu } from "./styled"
import { restaurantService } from "../../services/restaurant"
import type { Order, Restaurant } from "../../types/types"
import { initMercadoPago } from "@mercadopago/sdk-react"
import { AppRoutes } from "../../routes/path"

const BASE_URL = import.meta.env.VITE_BASE_URL
const PUBLIC_KEY = import.meta.env.VITE_PUBLIC_KEY_TP
const PENDING_PAYMENT_MUTATION_MESSAGE =
    'Há um pagamento Pix pendente. Aguarde o botão "Cancelar pedido" ficar disponível e cancele o pagamento antes de alterar a quantidade ou remover itens.'
if (PUBLIC_KEY) {
    initMercadoPago(PUBLIC_KEY)
}

const getErrorMessage = (error:unknown, fallback:string):string=>{
    if(axios.isAxiosError(error)){
        const message = error.response?.data?.message
        if(typeof message === 'string') return message
        return error.message || fallback
    }

    return error instanceof Error ? error.message : fallback
}



const Cart:FC = ()=>{
    const navigate = useNavigate()
    const qrCodeRef = useRef<HTMLDivElement>(null)
    const cartRef = useRef<HTMLDivElement>(null)
    const { cart, setCart, getAllOrders, getProfile, user } = useGlobal()
    const token = useMemo(() => localStorage.getItem('token'), [])
    // Customer Address Safe Strings Data Extraction
    const address = user?.street || ''
    const number = user?.number || 'S/N'
    const cep = user?.cep || ''
    const local = user?.neighbourhood ? `${user.neighbourhood} - ${user.city}/${user.state}` : ''
    const reference = user?.complement || ''
    const talkTo = user?.username ? user.username.split(' ')[0] : ''

    
    const calculateTotal = (items: Order[]) =>
        items.reduce((acc, item) => acc + Number(item.price) * Number(item.quantity), 0)
    const total = calculateTotal(cart)
    const [mpModalOpen, setMpModalOpen] = useState<boolean>(false)
    const [isProcessing, setIsProcessing] = useState<boolean>(false)
    // Payment Response Parameters State Hooks
    const [status, setStatus] = useState<string>('')
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null)
    const [qrCodeLink, setQrCodeLink] = useState<string | null>(null)
    const [internalPaymentId, setInternalPaymentId] = useState<string | null>(null)
    const [canCancelPayment, setCanCancelPayment] = useState<boolean>(false)
    const [isCancellingPayment, setIsCancellingPayment] = useState<boolean>(false)
    const [copyMessage, setCopyMessage] = useState<string>('')
    const [method, setMethod] = useState<'pix' | 'boleto' | 'card' | null>(null)
    const [loadedRestaurants, setLoadedRestaurants] = useState<Restaurant[]>([])
    const [selectedProviderId, setSelectedProviderId] = useState<string>('')
    const [isNavigationOpen, setIsNavigationOpen] = useState<boolean>(false)
    
    const hasQrCode = !!(qrCode || qrCodeBase64 || qrCodeLink)
    const pollingIntervalRef = useRef<ReturnType<typeof setInterval>>(null)
    const cancelButtonTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)



    const providerIdsKey = [...new Set(cart.map(item => item.provider))].join(',')
    const providerIds = useMemo(
        () => providerIdsKey ? providerIdsKey.split(',') : [],
        [providerIdsKey]
    )
    const restaurants = loadedRestaurants.filter(restaurant =>
        providerIds.includes(restaurant.id)
    )

    useEffect(()=>{
        let cancelled = false

        if(providerIds.length === 0){
            return
        }

        Promise.all(
            providerIds.map(id => restaurantService.restaurantByCustomer(id))
        )
            .then(data =>{
                if(cancelled) return

                setLoadedRestaurants(data)
                setSelectedProviderId(current =>
                    providerIds.includes(current) ? current : providerIds[0]
                )
            })
            .catch(error =>{
                if(!cancelled) console.error('Falha ao buscar estabelecimentos: ', error)
            })

        return () =>{
            cancelled = true
        }
    }, [providerIds])


    // Authenticated Guard Verification Lifecycle
    useEffect(() => {
        if (!token) {
            navigate('/', { replace: true })
            return
        }
        getProfile()
        getAllOrders()
    }, [token, navigate, getProfile, getAllOrders])

    // UI Escape Key Listener for Modals
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                setMpModalOpen(false)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Secure Auto-Polling Garbage Collection Cleanup
    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
            if (cancelButtonTimeoutRef.current) clearTimeout(cancelButtonTimeoutRef.current)
        }
    }, [])


    useEffect(() => {
        if (hasQrCode && qrCodeRef.current) {
            qrCodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
        } else if (cart.length > 0 && cartRef.current) {
            cartRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }, [hasQrCode, cart.length])



    const selectedOrders = cart.filter(
        item => item.provider === selectedProviderId
    )  

    const selectedRestaurant = restaurants.find(
        restaurant => restaurant.id === selectedProviderId
    )

    const selectedTotal = calculateTotal(selectedOrders)


    const handleQuantityChange = async(e:ChangeEvent<HTMLInputElement>, id:string)=>{
        if(internalPaymentId){
            alert(PENDING_PAYMENT_MUTATION_MESSAGE)
            return
        }

        const newQuantity = Math.max(1, Number(e.target.value))

        try{
            await axios.patch(
                `${BASE_URL}/orders/${id}/quantity`,
                { quantity: newQuantity },
                { headers: { Authorization: token || '' } }
            )
            setCart(prev => prev.map(item =>
                item.id === id ? { ...item, quantity: newQuantity } : item
            ))
        }catch(error:unknown){
            const message = getErrorMessage(error, 'Não foi possível alterar a quantidade')
            console.error(message)
            alert(message)
        }
    }


    const removeItem = async(id:string)=>{
        if(internalPaymentId){
            alert(PENDING_PAYMENT_MUTATION_MESSAGE)
            return
        }

        try{
            await axios.delete(`${BASE_URL}/orders/${id}`, {
                headers: { Authorization: token || '' }
            })
            setCart(prev => prev.filter(order => order.id !== id))
            getAllOrders()
        }catch(error:unknown){
            const message = getErrorMessage(error, 'Não foi possível excluir o pedido')
            console.error(message)
            alert(message)
        }
    }

    const resetPaymentUi = useCallback(()=>{
        if(pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
        if(cancelButtonTimeoutRef.current) clearTimeout(cancelButtonTimeoutRef.current)
        setQrCode(null)
        setQrCodeBase64(null)
        setQrCodeLink(null)
        setInternalPaymentId(null)
        setCanCancelPayment(false)
        setMethod(null)
        setStatus('')
    }, [])

    const clearCartOnSuccess = useCallback(async()=>{
        await getAllOrders()
        resetPaymentUi()
    }, [getAllOrders, resetPaymentUi])

    const pendingPixCachePrefix = useCallback(
        (paymentId:string)=>`meu-delivery:pending-pix:${paymentId}`,
        []
    )

    const clearPendingPixCache = useCallback((paymentId:string)=>{
        const key = pendingPixCachePrefix(paymentId)
        sessionStorage.removeItem(`${key}:qrCode`)
        sessionStorage.removeItem(`${key}:qrCodeBase64`)
        sessionStorage.removeItem(`${key}:qrCodeLink`)
    }, [pendingPixCachePrefix])

    const startPaymentPolling = useCallback((paymentId:string)=>{
        if(pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)

        pollingIntervalRef.current = setInterval(async()=>{
            try{
                const statusResponse = await axios.get(
                    `${BASE_URL}/orders/payment/${paymentId}/status`,
                    { headers: { Authorization: token || '' } }
                )
                const currentStatus = String(statusResponse.data.status || '').toLowerCase()

                if(['approved', 'rejected', 'cancelled', 'expired'].includes(currentStatus)){
                    if(pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
                    if(cancelButtonTimeoutRef.current) clearTimeout(cancelButtonTimeoutRef.current)

                    clearPendingPixCache(paymentId)
                    setCanCancelPayment(false)
                    setInternalPaymentId(null)
                    setStatus(currentStatus)
                    await clearCartOnSuccess()
                }

                if(currentStatus === 'approved'){
                    alert('Pagamento via Pix aprovado!')
                }
            }catch(error:unknown){
                console.error('Falha ao consultar o status do pagamento:', error)
            }
        }, 5000)
    }, [token, clearPendingPixCache, clearCartOnSuccess])

    useEffect(()=>{
        let cancelled = false

        const restorePendingPayment = async()=>{
            try{
                const response = await axios.get(
                    `${BASE_URL}/orders/payment/pending`,
                    { headers: { Authorization: token || '' } }
                )
                const payment = response.data
                const createdAt = Date.parse(payment.createdAt)

                if(!payment.orderId || !Number.isFinite(createdAt)){
                    throw new Error('Os dados do pagamento pendente são inválidos')
                }
                if(cancelled) return

                setMethod('pix')
                setStatus(payment.status)

                const cacheKey = pendingPixCachePrefix(payment.orderId)
                setQrCode(
                    payment.qrCode ||
                    sessionStorage.getItem(`${cacheKey}:qrCode`) ||
                    null
                )
                setQrCodeBase64(
                    payment.qrCodeBase64 ||
                    sessionStorage.getItem(`${cacheKey}:qrCodeBase64`) ||
                    null
                )
                setQrCodeLink(
                    payment.qrCodeLink ||
                    sessionStorage.getItem(`${cacheKey}:qrCodeLink`) ||
                    null
                )
                setInternalPaymentId(payment.orderId)

                if(['approved', 'rejected', 'cancelled', 'expired'].includes(
                    String(payment.status).toLowerCase()
                )){
                    setCanCancelPayment(false)
                    clearPendingPixCache(payment.orderId)
                    setInternalPaymentId(null)
                    await getAllOrders()
                    return
                }

                const remainingMs = Math.max(0, 60_000 - (Date.now() - createdAt))
                setCanCancelPayment(remainingMs === 0)
                if(remainingMs > 0){
                    cancelButtonTimeoutRef.current = setTimeout(
                        () => setCanCancelPayment(true),
                        remainingMs
                    )
                }
                startPaymentPolling(payment.orderId)
            }catch(error:unknown){
                if(
                    cancelled ||
                    (axios.isAxiosError(error) && error.response?.status === 404)
                ) return
                console.error(
                    'Não foi possível recuperar o pagamento pendente:',
                    getErrorMessage(error, 'Erro desconhecido')
                )
            }
        }

        if(token) void restorePendingPayment()

        return ()=>{
            cancelled = true
        }
    }, [
        token,
        clearPendingPixCache,
        clearCartOnSuccess,
        getAllOrders,
        pendingPixCachePrefix,
        startPaymentPolling
    ])


    const handlePixPayment = async()=>{
        if(isProcessing || internalPaymentId) return
        setIsProcessing(true)
        setMethod('pix')

        try{
            const response = await axios.post(
                `${BASE_URL}/orders/payment`,
                { paymentMethodId: 'pix' },
                { headers: { Authorization: token || '' } }
            )

            setStatus(response.data.status || 'pending')
            setQrCode(response.data.qrCode || null)
            setQrCodeBase64(response.data.qrCodeBase64 || null)
            setQrCodeLink(response.data.qrCodeLink || null)

            const paymentId = response.data.orderId
            if(!paymentId) throw new Error('A resposta do pagamento não contém o identificador interno')

            const cacheKey = pendingPixCachePrefix(paymentId)
            sessionStorage.setItem(`${cacheKey}:qrCode`, response.data.qrCode || '')
            sessionStorage.setItem(`${cacheKey}:qrCodeBase64`, response.data.qrCodeBase64 || '')
            sessionStorage.setItem(`${cacheKey}:qrCodeLink`, response.data.qrCodeLink || '')
            setInternalPaymentId(paymentId)
            setCanCancelPayment(false)

            if(cancelButtonTimeoutRef.current) clearTimeout(cancelButtonTimeoutRef.current)
            cancelButtonTimeoutRef.current = setTimeout(
                () => setCanCancelPayment(true),
                60_000
            )

            startPaymentPolling(paymentId)
        }catch(error:unknown){
            const message = getErrorMessage(error, 'Falha ao iniciar o pagamento Pix')
            console.error(message)
            alert(message)
        }finally{
            setIsProcessing(false)
        }
    }


    const handleCancelPayment = async()=>{
        if(!internalPaymentId || isCancellingPayment) return
        setIsCancellingPayment(true)

        try{
            await axios.post(
                `${BASE_URL}/orders/payment/${internalPaymentId}/cancel`,
                {},
                { headers: { Authorization: token || '' } }
            )

            if(pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
            if(cancelButtonTimeoutRef.current) clearTimeout(cancelButtonTimeoutRef.current)
            clearPendingPixCache(internalPaymentId)
            setInternalPaymentId(null)
            setCanCancelPayment(false)
            setStatus('cancelled')
            alert('Pagamento cancelado. O pedido foi expirado e o estoque liberado.')
            await clearCartOnSuccess()
        }catch(error:unknown){
            const message = getErrorMessage(error, 'Não foi possível cancelar o pagamento')
            console.error(message)
            alert(message)
        }finally{
            setIsCancellingPayment(false)
        }
    }


    const handlePaymentCard = () => {
        if(method === 'pix' && status === 'pending' && internalPaymentId){
            alert(
                'Há um pagamento Pix pendente. Aguarde a opção "Cancelar pedido", cancele o Pix e faça um novo pedido para pagar com cartão. O cancelamento expira o pedido e devolve os itens ao estoque.'
            )
            return
        }

        if(!PUBLIC_KEY){
            alert('Pagamento com cartão indisponível: configure VITE_PUBLIC_KEY_TP no ambiente do cliente.')
            return
        }

       setQrCode(null)
        setQrCodeBase64(null)
        setQrCodeLink(null)
        setMethod('card')
        setMpModalOpen(true)
    }


    const copyPixCode = async()=>{
        if(!qrCode) return

        try{
            await navigator.clipboard.writeText(qrCode)
            setCopyMessage('Código Pix copiado')
        }catch(error){
            console.error('Falha ao copiar o código Pix:', error)
            setCopyMessage('Não foi possível copiar. Copie o código manualmente.')
        }
    }


    const notifyViaWhatsApp = ()=>{
        if(!selectedRestaurant || selectedOrders.length === 0) return

        const orderDetails = selectedOrders.map(item=>
            `${item.quantity} x ${item.product} - $${Number(item.price).toFixed(2)}`
        ).join('\n')

        const message =
            `Pedido para ${selectedRestaurant.name}:\n\n${orderDetails}\n\n` +
            `Total: R$ ${selectedTotal.toFixed(2)}\n\n` +
            `Endereço: ${address}, ${number}\nCEP: ${cep}\nBairro: ${local}\n` +
            `Referência: ${reference.trim()}\nContato: ${talkTo}`

        window.open(
            `https://wa.me/${selectedRestaurant.phone}?text=${encodeURIComponent(message)}`,
            "_blank"
        )
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
                                        navigate(AppRoutes.HOME)
                                    }}
                                >
                                    Home
                                </button>

                                <button
                                    type='button'
                                    onClick={()=>{
                                        setIsNavigationOpen(false)
                                        navigate(AppRoutes.DETAIL)
                                    }}
                                >
                                    Provedor
                                </button>
                            </nav>
                        )}
                    </NavigationMenu>
                }
                rightIcon={<IoPersonOutline className="header-icon" onClick={() => navigate('/profile')} />}
            />

            <Container>
                <h1>Meu Carrinho</h1>
                <hr style={{ width: '100%', marginBottom: '15px', backgroundColor: 'lightgray', border: 'none', height: '1px' }} />
                
                <div className="address-section">
                    <div>
                        <b>Endereço para entrega</b>: {address ? `${address}, ${number}` : 'Sem endereço adicionado'}<br />
                        <b>CEP</b>: {cep}<br />
                        <b>Bairro</b>: {local}<br />
                        <b>Ponto de referência</b>: {reference || 'N/A'}<br />
                        <b>Contato</b>: {talkTo}
                    </div>
                    <MdEdit className="icon" onClick={() => navigate('/user-address', { state: { mode: 'cart' } })} />
                </div>

                <div className="addressAndName">
                    <div className="rest-name">Seus Produtos</div>
                    <div style={{marginTop:10, textAlign:'center'}}>Total Geral: R$ {Number(total).toFixed(2)}</div>
                </div>
                <hr style={{ width: '100%', marginBottom: '15px', backgroundColor: 'lightgray', border: 'none', height: '1px' }} />

                <div className="restaurants-container">
                    {restaurants.map(restaurant => (
                        <button
                            className="restaurant-button"
                            key={restaurant.id}
                            onClick={() => setSelectedProviderId(restaurant.id)}
                        >
                            {restaurant.name}
                        </button>
                    ))}
                </div>

                <div className="cart-container" ref={cartRef}>
                    {selectedOrders.length > 0 ? selectedOrders.map(item => (
                        <div className="card" key={item.id}>
                            <span>
                                <img src={`imgs/products/${item.photoUrl}`} alt={item.product} />
                            </span>
                            <span>
                                <div className="product-name">{item.product}</div>
                                <div className="product-details">
                                    <b>Quantidade: </b>{item.quantity} <br />
                                    <b>Preço: </b>R$ {Number(item.price).toFixed(2)} <br />
                                    <b>Total: </b>R$ {(Number(item.price) * Number(item.quantity)).toFixed(2)} <br />
                                </div>
                            </span>
                            <div className="btn-container">
                                <input 
                                    type="number"
                                    min={1} 
                                    value={item.quantity}
                                    onChange={(e) => handleQuantityChange(e, item.id)}
                                    disabled={isProcessing}
                                    className="input-number" 
                                />                 
                                <button
                                    className="btn-remove"
                                    onClick={() => removeItem(item.id)}
                                    disabled={isProcessing}
                                >
                                    Remover
                                </button>
                            </div>
                        </div>
                    )) : <div style={{ margin: 20, textAlign: 'center', color: '#666' }}>Seu carrinho está vazio.</div>}
                </div>

                {/* Mercado Pago Integration Components Layer */}
                {mpModalOpen && method === 'card' && (
                    <MpModal
                        setModalOpen={setMpModalOpen}
                        setQrCode={setQrCode}
                        total={total}
                        token={token || ''}
                        getAllOrders={getAllOrders}
                    />
                )}

                {/* Render Pix Instant QR Output Layout Block */}
                {method === 'pix' && hasQrCode && (
                    <div ref={qrCodeRef} className="payment-gateway-pix-box" style={{ marginTop: '2rem', textAlign: 'center' }}>
                        <h3>Escaneie o QR Code para concluir o pagamento:</h3>
                        {qrCodeBase64 ? (
                            <img width='220' src={`data:image/png;base64,${qrCodeBase64}`} alt="Instant Pix QR Code" style={{ margin: '15px auto' }} />
                        ) : qrCode ? (
                            <img width='220' src={`https://chart.googleapis.com/chart?cht=qr&chs=250x250&chl=${encodeURIComponent(qrCode)}`} alt="Instant Pix QR Code" style={{ margin: '15px auto' }} />
                        ) : null}

                        {qrCodeLink && (
                            <>
                                <p style={{ margin: '12px 0' }}>
                                    {qrCode && (
                                        <button
                                            className="copy-pix-btn"
                                            type="button" onClick={copyPixCode}>
                                            Copiar código Pix
                                        </button>
                                    )}
                                </p>
                                <a href={qrCodeLink} target="_blank" rel="noopener noreferrer" className="gateway-link-btn" style={{ color: '#b11717', fontWeight: 600 }}>
                                    Abrir página de pagamento
                                </a>
                            </>
                        )}

                        {copyMessage && <p role="status">{copyMessage}</p>}

                        {status && (
                            <div className={`status-pill ${status}`} style={{ fontWeight: 600, color: status === 'approved' ? 'green' : '#ff9800' }}>
                                Status: {status === 'pending' ? 'Aguardando confirmação do pagamento...' : status}
                            </div>
                        )}
                    </div>
                )}

                {import.meta.env.PROD &&
                    method === 'pix' &&
                    status === 'pending' &&
                    canCancelPayment &&
                    !hasQrCode && (
                        <div className="payment-unavailable-warning" role="alert">
                            <strong>O Pix não está disponível nesta tela.</strong>
                            <p>
                                Se você não salvou os dados do pagamento, cancele o pedido
                                usando o botão abaixo e depois faça um novo pedido.
                            </p>
                        </div>
                    )}

                {method === 'pix' &&
                    status === 'pending' &&
                    canCancelPayment &&
                    internalPaymentId && (
                        <button
                            className="cancel-payment-button"
                            type="button"
                            onClick={handleCancelPayment}
                            disabled={isCancellingPayment}
                        >
                            {isCancellingPayment ? 'Cancelando...' : 'Cancelar pedido'}
                        </button>
                    )}

                {cart.length > 0 && (
                    <div className="total-container">
                        <div className="totalByGroup"><b>Total do estabelecimento</b>: R$ {selectedTotal.toFixed(2)}</div>
                        
                        <div className="payment-action-hub" style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                            <button 
                                className="address-button" 
                                onClick={handlePixPayment} 
                                disabled={isProcessing}
                                style={{ flex: 1, padding: '10px', cursor: 'pointer', backgroundColor: '#00bfa5', color: 'white', border: 'none', borderRadius: '6px' }}
                            >
                                {isProcessing ? 'Processando...' : 'Pagar com Pix'}
                            </button>

                            <button 
                                className="requestOrder-btn"
                                style={{
                                    width: '100%',
                                    maxWidth: '340px',
                                    padding: '12px',
                                    fontWeight: 600,
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'white',
                                    backgroundColor: '#25D366' // Standard WhatsApp brand color theme
                                }}
                                onClick={notifyViaWhatsApp}
                            >
                                Avisar pelo WhatsApp
                            </button>  

                            <button 
                                className="address-button" 
                                onClick={handlePaymentCard}
                                style={{ flex: 1, padding: '10px', cursor: 'pointer', backgroundColor: '#2979ff', color: 'white', border: 'none', borderRadius: '6px' }}
                            >
                                Cartão de crédito
                            </button>
                        </div>
                    </div>
                )}
            </Container>
        </>
    )


}


export default Cart
