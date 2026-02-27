const normalize = (value) => String(value || '').toLowerCase()

const getAvailablePackages = (offerings) => offerings?.current?.availablePackages || []

const isMonthlyPackage = (pkg) => {
    const identifier = normalize(pkg?.identifier)
    const packageType = normalize(pkg?.packageType)
    const productId = normalize(pkg?.product?.identifier)

    return (
        identifier === '$rc_monthly' ||
        identifier === 'monthly' ||
        identifier.includes('monthly') ||
        packageType === 'monthly' ||
        productId.includes('monthly')
    )
}

const isYearlyPackage = (pkg) => {
    const identifier = normalize(pkg?.identifier)
    const packageType = normalize(pkg?.packageType)
    const productId = normalize(pkg?.product?.identifier)

    return (
        identifier === '$rc_annual' ||
        identifier === 'annual' ||
        identifier === 'yearly' ||
        identifier.includes('annual') ||
        identifier.includes('yearly') ||
        packageType === 'annual' ||
        packageType === 'yearly' ||
        productId.includes('annual') ||
        productId.includes('yearly')
    )
}

const toNumber = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value

    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (/^\d+(\.\d+)?$/.test(trimmed)) {
            const parsed = Number(trimmed)
            if (Number.isFinite(parsed)) return parsed
        }
    }

    return null
}

const formatCurrency = (amount, currencyCode = 'USD', language = 'en-US') => {
    if (!Number.isFinite(amount)) return null

    try {
        return new Intl.NumberFormat(language, {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount)
    } catch {
        return `$${amount.toFixed(2)}`
    }
}

const getPackagePriceString = (pkg, language) => {
    const direct = pkg?.product?.priceString
    if (typeof direct === 'string' && direct.trim()) return direct.trim()

    const numeric = toNumber(pkg?.product?.price)
    if (numeric === null) return null

    return formatCurrency(numeric, pkg?.product?.currencyCode, language)
}

const getSavePercent = (monthlyPackage, yearlyPackage) => {
    const monthlyPrice = toNumber(monthlyPackage?.product?.price)
    const yearlyPrice = toNumber(yearlyPackage?.product?.price)

    if (monthlyPrice === null || yearlyPrice === null || monthlyPrice <= 0) return null

    const yearlyMonthlyEquivalent = yearlyPrice / 12
    const rawSavingsPercent = (1 - (yearlyMonthlyEquivalent / monthlyPrice)) * 100
    if (!Number.isFinite(rawSavingsPercent) || rawSavingsPercent <= 0) return null

    return Math.round(rawSavingsPercent)
}

export const getRevenueCatPlanPricing = ({
    offerings,
    language = 'en-US',
    fallbackMonthly = '$11.99',
    fallbackYearlyMonthly = '$9.17',
} = {}) => {
    const availablePackages = getAvailablePackages(offerings)
    const monthlyPackage = availablePackages.find(isMonthlyPackage) || null
    const yearlyPackage = availablePackages.find(isYearlyPackage) || null

    const monthlyPrice = getPackagePriceString(monthlyPackage, language) || fallbackMonthly
    const yearlyBillingPrice = getPackagePriceString(yearlyPackage, language)

    let yearlyMonthlyPrice = fallbackYearlyMonthly
    const yearlyNumericPrice = toNumber(yearlyPackage?.product?.price)
    if (yearlyNumericPrice !== null) {
        yearlyMonthlyPrice = formatCurrency(
            yearlyNumericPrice / 12,
            yearlyPackage?.product?.currencyCode,
            language
        ) || yearlyMonthlyPrice
    }

    return {
        monthlyPackage,
        yearlyPackage,
        monthlyPrice,
        yearlyMonthlyPrice,
        yearlyBillingPrice,
        savePercent: getSavePercent(monthlyPackage, yearlyPackage),
    }
}
