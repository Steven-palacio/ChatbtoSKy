//instanceAxios.ts
import dotenv from 'dotenv'
dotenv.config()
import axios from 'axios'

const API_BITRIX_URL = process.env.API_BITRIX_URL

const instanceAxios = axios.create({
    baseURL: API_BITRIX_URL,
    headers: {'Content-Type': 'application/json'}
})

export default instanceAxios