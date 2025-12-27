/* --- FILE: js/calculators.js --- */

// === 1. P2X (HYDROGEN) CALCULATOR ===
function updateLCOH() {
    // Get inputs
    const electrolyzerCapacityMW = parseFloat(document.getElementById('electrolyzer-capacity').value);
    const loadingFactor = parseFloat(document.getElementById('loading-factor').value) / 100;
    const elecPrice = parseFloat(document.getElementById('elec-price').value);
    const pvCF = parseFloat(document.getElementById('pv-cf').value) / 100;
    const pvCapacity = parseFloat(document.getElementById('pv-capacity').value);
    const windCF = parseFloat(document.getElementById('wind-cf').value) / 100;
    const windCapacity = parseFloat(document.getElementById('wind-capacity').value);
    const pvCost = parseFloat(document.getElementById('pv-cost').value);
    const windCost = parseFloat(document.getElementById('wind-cost').value);
    const electrolyzerCost = parseFloat(document.getElementById('electrolyzer-cost').value);
    const electrolyzerEff = parseFloat(document.getElementById('electrolyzer-eff').value);

    // Update display labels
    document.getElementById('electrolyzer-capacity-val').innerText = electrolyzerCapacityMW;
    document.getElementById('loading-factor-val').innerText = (loadingFactor * 100).toFixed(0);
    document.getElementById('elec-price-val').innerText = elecPrice;
    document.getElementById('pv-cf-val').innerText = (pvCF * 100).toFixed(1);
    document.getElementById('pv-capacity-val').innerText = pvCapacity;
    document.getElementById('wind-cf-val').innerText = (windCF * 100).toFixed(1);
    document.getElementById('wind-capacity-val').innerText = windCapacity;
    document.getElementById('pv-cost-val').innerText = pvCost;
    document.getElementById('wind-cost-val').innerText = windCost;
    document.getElementById('electrolyzer-cost-val').innerText = electrolyzerCost;
    document.getElementById('electrolyzer-eff-val').innerText = electrolyzerEff;

    // === ENERGY GENERATION CALCULATION ===
    const hoursPerYear = 8760;

    // Annual energy from PV (MWh/year)
    const pvEnergyAnnual = pvCapacity * pvCF * hoursPerYear;

    // Annual energy from Wind (MWh/year)
    const windEnergyAnnual = windCapacity * windCF * hoursPerYear;

    // Total renewable energy available (MWh/year)
    const totalRenewableEnergy = pvEnergyAnnual + windEnergyAnnual;

    // === HYDROGEN PRODUCTION CALCULATION ===
    // Maximum energy the electrolyzer can consume per year based on loading factor (MWh/year)
    const maxElectrolyzerEnergy = electrolyzerCapacityMW * loadingFactor * hoursPerYear;

    // Energy from renewables that electrolyzer can use (limited by electrolyzer capacity)
    const energyUsedByElectrolyzer = Math.min(totalRenewableEnergy, maxElectrolyzerEnergy);

    // Grid electricity needed if user wants higher loading factor than renewables can provide
    const gridEnergyNeeded = Math.max(0, maxElectrolyzerEnergy - totalRenewableEnergy);

    // Total energy consumed (MWh/year)
    const totalEnergyConsumed = energyUsedByElectrolyzer + gridEnergyNeeded;

    // Annual H2 production (kg/year)
    // Energy per kg is in kWh/kg, so convert MWh to kWh
    const annualH2ProductionKg = (totalEnergyConsumed * 1000) / electrolyzerEff;

    // Convert to tonnes/year
    const annualH2ProductionTonnes = annualH2ProductionKg / 1000;

    // Renewable fraction
    const renewableFraction = totalEnergyConsumed > 0 ? (energyUsedByElectrolyzer / totalEnergyConsumed) * 100 : 0;

    // === CAPEX CALCULATION (Annualized) ===
    const projectLifetime = 25; // years
    const discountRate = 0.08;
    const CRF = (discountRate * Math.pow(1 + discountRate, projectLifetime)) / (Math.pow(1 + discountRate, projectLifetime) - 1);

    const pvCapexAnnual = pvCapacity * pvCost * 1000 * CRF; // $/year
    const windCapexAnnual = windCapacity * windCost * 1000 * CRF; // $/year
    const electrolyzerCapexAnnual = electrolyzerCapacityMW * electrolyzerCost * 1000 * CRF; // $/year

    const totalCapexAnnual = pvCapexAnnual + windCapexAnnual + electrolyzerCapexAnnual;

    // === OPEX CALCULATION ===
    // Electricity cost from grid
    const gridElectricityCost = gridEnergyNeeded * elecPrice; // $/year

    // O&M costs (typically 2-3% of CAPEX per year)
    const omCost = (pvCapacity * pvCost * 1000 * 0.02) +
                   (windCapacity * windCost * 1000 * 0.025) +
                   (electrolyzerCapacityMW * electrolyzerCost * 1000 * 0.03);

    const totalOpexAnnual = gridElectricityCost + omCost;

    // === LCOH CALCULATION ===
    const totalAnnualCost = totalCapexAnnual + totalOpexAnnual;
    const LCOH = totalAnnualCost / annualH2ProductionKg;

    // Update display
    document.getElementById('final-lcoh').innerText = "$" + LCOH.toFixed(2);

    // Update breakdown
    if (document.getElementById('renewable-fraction')) {
        document.getElementById('renewable-fraction').innerText = renewableFraction.toFixed(1) + "%";
        document.getElementById('h2-production').innerText = annualH2ProductionTonnes.toLocaleString(undefined, {maximumFractionDigits: 0}) + " tonnes/yr";
        document.getElementById('grid-dependence').innerText = (gridEnergyNeeded / 1000).toFixed(1) + " GWh/yr";
    }
}

// === 2. BESS (BATTERY) REVENUE CALCULATOR ===
let bessRevenueChart = null; // Global variable to store chart instance

function updateBESSRevenue() {
    // === GET INPUTS ===

    // Battery Configuration
    const bessPower = parseFloat(document.getElementById('bess-power').value);
    const bessEnergy = parseFloat(document.getElementById('bess-energy').value);
    const bessRTE = parseFloat(document.getElementById('bess-rte').value) / 100;
    const degradationCost = parseFloat(document.getElementById('degradation-cost').value);

    // Service Selection
    const serviceArbitrage = document.getElementById('service-arbitrage').checked;
    const serviceMFRR = document.getElementById('service-manual-frr').checked;
    const serviceAFRR = document.getElementById('service-auto-frr').checked;
    const serviceFCR = document.getElementById('service-fcr').checked;
    const serviceCongestion = document.getElementById('service-congestion').checked;
    const serviceCapacity = document.getElementById('service-capacity').checked;

    // Market Parameters
    const avgDAPrice = parseFloat(document.getElementById('avg-da-price').value);
    const priceVolatility = parseFloat(document.getElementById('price-volatility').value) / 100;
    const mFRRPrice = parseFloat(document.getElementById('mfrr-price').value);
    const aFRRPrice = parseFloat(document.getElementById('afrr-price').value);
    const fcrPrice = parseFloat(document.getElementById('fcr-price').value);
    const capacityPayment = parseFloat(document.getElementById('capacity-payment').value);

    // === UPDATE DISPLAY LABELS ===
    document.getElementById('bess-power-val').innerText = bessPower;
    document.getElementById('bess-energy-val').innerText = bessEnergy;
    document.getElementById('bess-rte-val').innerText = (bessRTE * 100).toFixed(0);
    document.getElementById('degradation-cost-val').innerText = degradationCost.toFixed(1);

    document.getElementById('avg-da-price-val').innerText = avgDAPrice;
    document.getElementById('price-volatility-val').innerText = (priceVolatility * 100).toFixed(0);
    document.getElementById('mfrr-price-val').innerText = mFRRPrice;
    document.getElementById('afrr-price-val').innerText = aFRRPrice;
    document.getElementById('fcr-price-val').innerText = fcrPrice;
    document.getElementById('capacity-payment-val').innerText = capacityPayment.toLocaleString();

    // === REVENUE CALCULATION ===
    const hoursPerYear = 8760;

    // Calculate battery duration (hours)
    const duration = bessEnergy / bessPower;

    // Energy Arbitrage Revenue
    let arbitrageRevenue = 0;
    let arbitrageCycles = 0;
    if (serviceArbitrage) {
        // Estimate daily cycles based on price volatility
        arbitrageCycles = Math.min(365, Math.floor(priceVolatility * 365 * 0.8)); // Max 1 cycle/day
        const spreadPerCycle = avgDAPrice * priceVolatility * 0.6; // Average spread capture
        const energyThroughput = arbitrageCycles * bessEnergy; // MWh/year

        // Revenue = (spread * energy) - (degradation + efficiency losses)
        const grossRevenue = spreadPerCycle * arbitrageCycles * bessPower;
        const efficiencyLoss = energyThroughput * avgDAPrice * (1 - bessRTE);
        const degradationLoss = energyThroughput * degradationCost;

        arbitrageRevenue = grossRevenue - efficiencyLoss - degradationLoss;
    }

    // Manual FRR Revenue (capacity payments + activation)
    let mFRRRevenue = 0;
    let mFRRHours = 0;
    if (serviceMFRR) {
        // Assume 50% of time available for mFRR
        mFRRHours = hoursPerYear * 0.5;
        const capacityRevenue = bessPower * mFRRPrice * mFRRHours;
        const activationRevenue = bessPower * 50 * mFRRHours * 0.05; // 5% activation rate at €50/MWh
        mFRRRevenue = capacityRevenue + activationRevenue;
    }

    // Automatic FRR Revenue
    let aFRRRevenue = 0;
    let aFRRHours = 0;
    if (serviceAFRR) {
        // Assume 30% of time for aFRR (higher activation rate)
        aFRRHours = hoursPerYear * 0.3;
        const capacityRevenue = bessPower * aFRRPrice * aFRRHours;
        const activationRevenue = bessPower * 60 * aFRRHours * 0.15; // 15% activation rate
        aFRRRevenue = capacityRevenue + activationRevenue;
    }

    // FCR Revenue (highest price, most restrictive)
    let fcrRevenue = 0;
    let fcrHours = 0;
    if (serviceFCR) {
        // Assume 20% of time for FCR (continuous availability required)
        fcrHours = hoursPerYear * 0.2;
        fcrRevenue = bessPower * fcrPrice * fcrHours;
    }

    // Congestion Management Revenue
    let congestionRevenue = 0;
    if (serviceCongestion) {
        // Opportunistic service, assume 10% of year with high premiums
        const congestionHours = hoursPerYear * 0.1;
        congestionRevenue = bessPower * avgDAPrice * 1.5 * congestionHours * 0.3; // 30% dispatch rate
    }

    // Capacity Market Revenue
    let capacityRevenue = 0;
    if (serviceCapacity) {
        // Monthly payments for 12 months
        capacityRevenue = bessPower * capacityPayment * 12;
    }

    // Total Revenue
    const totalRevenue = arbitrageRevenue + mFRRRevenue + aFRRRevenue + fcrRevenue + congestionRevenue + capacityRevenue;

    // Calculate total cycles and utilization
    const totalCycles = arbitrageCycles + (aFRRHours / hoursPerYear * 200); // aFRR contributes partial cycles
    const utilizationRate = Math.min(100, (totalCycles / 365) * 100);

    // Simple ROI (assuming €800k/MW CAPEX)
    const totalCAPEX = bessPower * 800000; // €800k/MW
    const simplePayback = totalRevenue > 0 ? totalCAPEX / totalRevenue : 0;

    // === UPDATE DISPLAY ===
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

    document.getElementById('total-revenue').innerText = formatter.format(totalRevenue);
    document.getElementById('utilization-rate').innerText = utilizationRate.toFixed(1) + "%";
    document.getElementById('cycles-per-year').innerText = Math.round(totalCycles);
    document.getElementById('roi-years').innerText = simplePayback < 100 ? simplePayback.toFixed(1) + " years" : "> 100 years";

    // === UPDATE CHART ===
    const ctx = document.getElementById('revenueChart');
    if (ctx) {
        // Destroy previous chart instance if it exists
        if (bessRevenueChart) {
            bessRevenueChart.destroy();
        }

        // Prepare data for chart
        const revenueData = [];
        const revenueLabels = [];
        const revenueColors = [];

        if (serviceArbitrage && arbitrageRevenue > 0) {
            revenueData.push(arbitrageRevenue);
            revenueLabels.push('Energy Arbitrage');
            revenueColors.push('rgba(251, 191, 36, 0.8)');
        }
        if (serviceMFRR && mFRRRevenue > 0) {
            revenueData.push(mFRRRevenue);
            revenueLabels.push('Manual FRR');
            revenueColors.push('rgba(96, 165, 250, 0.8)');
        }
        if (serviceAFRR && aFRRRevenue > 0) {
            revenueData.push(aFRRRevenue);
            revenueLabels.push('Automatic FRR');
            revenueColors.push('rgba(118, 255, 3, 0.8)');
        }
        if (serviceFCR && fcrRevenue > 0) {
            revenueData.push(fcrRevenue);
            revenueLabels.push('FCR (Primary)');
            revenueColors.push('rgba(239, 68, 68, 0.8)');
        }
        if (serviceCongestion && congestionRevenue > 0) {
            revenueData.push(congestionRevenue);
            revenueLabels.push('Congestion Mgmt');
            revenueColors.push('rgba(168, 85, 247, 0.8)');
        }
        if (serviceCapacity && capacityRevenue > 0) {
            revenueData.push(capacityRevenue);
            revenueLabels.push('Capacity Market');
            revenueColors.push('rgba(0, 136, 204, 0.8)');
        }

        // Create new chart
        bessRevenueChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: revenueLabels,
                datasets: [{
                    data: revenueData,
                    backgroundColor: revenueColors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 15,
                            padding: 12,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return label + ': €' + value.toLocaleString(undefined, {maximumFractionDigits: 0}) + ' (' + percentage + '%)';
                            }
                        }
                    }
                }
            }
        });
    }
}

// === 3. MICROGRID DESIGN CALCULATOR ===
let microgridChart = null; // Global variable to store chart instance

function updateMicrogrid() {
    // === GET INPUTS ===

    // Load Profile
    const loadProfileType = document.querySelector('input[name="load-profile"]:checked').value;
    const peakLoad = parseFloat(document.getElementById('peak-load').value);

    // Technology Capacities
    const pvCapacity = parseFloat(document.getElementById('pv-capacity-mg').value);
    const windCapacity = parseFloat(document.getElementById('wind-capacity-mg').value);
    const bessCapacity = parseFloat(document.getElementById('bess-capacity').value);
    const dieselCapacity = parseFloat(document.getElementById('diesel-capacity').value);

    // CAPEX
    const pvCapex = parseFloat(document.getElementById('pv-capex').value);
    const windCapex = parseFloat(document.getElementById('wind-capex').value);
    const bessCapex = parseFloat(document.getElementById('bess-capex').value);
    const dieselCapex = parseFloat(document.getElementById('diesel-capex').value);

    // OPEX
    const pvOpex = parseFloat(document.getElementById('pv-opex').value) / 100;
    const windOpex = parseFloat(document.getElementById('wind-opex').value) / 100;
    const bessOpex = parseFloat(document.getElementById('bess-opex').value) / 100;
    const dieselFuelPrice = parseFloat(document.getElementById('diesel-fuel-price').value);

    // System Parameters
    const pvCF = parseFloat(document.getElementById('pv-cf-mg').value) / 100;
    const windCF = parseFloat(document.getElementById('wind-cf-mg').value) / 100;
    const bessEff = parseFloat(document.getElementById('bess-eff').value) / 100;
    const dieselEff = parseFloat(document.getElementById('diesel-eff').value);

    // === UPDATE DISPLAY LABELS ===
    document.getElementById('peak-load-val').innerText = peakLoad;
    document.getElementById('pv-capacity-mg-val').innerText = pvCapacity;
    document.getElementById('wind-capacity-mg-val').innerText = windCapacity;
    document.getElementById('bess-capacity-val').innerText = bessCapacity;
    document.getElementById('diesel-capacity-val').innerText = dieselCapacity;

    document.getElementById('pv-capex-val').innerText = pvCapex;
    document.getElementById('wind-capex-val').innerText = windCapex;
    document.getElementById('bess-capex-val').innerText = bessCapex;
    document.getElementById('diesel-capex-val').innerText = dieselCapex;

    document.getElementById('pv-opex-val').innerText = (pvOpex * 100).toFixed(1);
    document.getElementById('wind-opex-val').innerText = (windOpex * 100).toFixed(1);
    document.getElementById('bess-opex-val').innerText = (bessOpex * 100).toFixed(1);
    document.getElementById('diesel-fuel-price-val').innerText = dieselFuelPrice.toFixed(1);

    document.getElementById('pv-cf-mg-val').innerText = (pvCF * 100).toFixed(0);
    document.getElementById('wind-cf-mg-val').innerText = (windCF * 100).toFixed(0);
    document.getElementById('bess-eff-val').innerText = (bessEff * 100).toFixed(0);
    document.getElementById('diesel-eff-val').innerText = dieselEff.toFixed(1);

    // === SIMPLIFIED HOURLY SIMULATION ===
    // We'll simulate a typical day using representative hourly profiles for each load type

    // Define normalized load profiles (24 hours, values 0-1 relative to peak)
    let loadProfile;
    if (loadProfileType === 'commercial') {
        // Commercial: Low at night, high during business hours
        loadProfile = [0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.6, 0.8, 0.9, 0.95, 1.0, 1.0,
                       0.95, 0.9, 0.85, 0.85, 0.8, 0.75, 0.7, 0.6, 0.5, 0.4, 0.35, 0.3];
    } else if (loadProfileType === 'industrial') {
        // Industrial: Relatively flat baseload
        loadProfile = [0.85, 0.85, 0.85, 0.85, 0.85, 0.9, 0.95, 1.0, 1.0, 1.0, 1.0, 1.0,
                       1.0, 1.0, 1.0, 1.0, 1.0, 0.95, 0.9, 0.9, 0.9, 0.85, 0.85, 0.85];
    } else { // residential
        // Residential: Morning and evening peaks
        loadProfile = [0.4, 0.35, 0.3, 0.3, 0.35, 0.5, 0.7, 0.85, 0.75, 0.6, 0.55, 0.5,
                       0.5, 0.5, 0.55, 0.6, 0.7, 0.85, 1.0, 0.95, 0.8, 0.65, 0.55, 0.45];
    }

    // PV generation profile (bell curve, peak at noon)
    const pvProfile = [0, 0, 0, 0, 0, 0, 0.1, 0.3, 0.5, 0.7, 0.85, 0.95,
                       1.0, 0.95, 0.85, 0.7, 0.5, 0.3, 0.1, 0, 0, 0, 0, 0];

    // Wind generation profile (higher at night in many locations)
    const windProfile = [0.7, 0.75, 0.8, 0.8, 0.75, 0.7, 0.6, 0.5, 0.45, 0.4, 0.35, 0.3,
                         0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.65, 0.7, 0.75, 0.75, 0.7, 0.7];

    // Run hourly simulation
    let bessSOC = bessCapacity * 0.5; // Start at 50% SOC
    let totalDieselEnergy = 0;
    let totalRenewableEnergy = 0;
    let totalLoad = 0;
    let totalBESSCycles = 0;
    let dieselRuntime = 0;

    // Arrays to store hourly data for chart
    const hourlyLoad = [];
    const hourlyPV = [];
    const hourlyWind = [];
    const hourlyDiesel = [];
    const hourlyBESSCharge = [];
    const hourlyBESSDischarge = [];

    for (let hour = 0; hour < 24; hour++) {
        // Calculate generation and load for this hour (kW average)
        const loadThisHour = peakLoad * loadProfile[hour];
        const pvGenThisHour = pvCapacity * pvProfile[hour];
        const windGenThisHour = windCapacity * windCF * windProfile[hour];

        // Total renewable generation
        const renewableGen = pvGenThisHour + windGenThisHour;

        // Net load after renewables
        const netLoad = loadThisHour - renewableGen;

        totalRenewableEnergy += renewableGen;
        totalLoad += loadThisHour;

        // Store hourly data for chart
        hourlyLoad.push(loadThisHour);
        hourlyPV.push(pvGenThisHour);
        hourlyWind.push(windGenThisHour);

        let bessDischarge = 0;
        let bessCharge = 0;
        let dieselGen = 0;

        if (netLoad > 0) {
            // Need more energy - discharge BESS first, then diesel
            const maxBESSDischarge = Math.min(bessSOC, bessCapacity * 0.25); // Max 0.25C discharge rate, limited by SOC
            bessDischarge = Math.min(netLoad / bessEff, maxBESSDischarge); // Adjust for efficiency losses
            const actualEnergyDelivered = bessDischarge * bessEff; // Energy delivered to load after losses

            bessSOC -= bessDischarge;
            totalBESSCycles += bessDischarge / (bessCapacity * 2); // Discharge contributes to cycles

            const remainingLoad = netLoad - actualEnergyDelivered;

            if (remainingLoad > 0.01) { // Small tolerance to avoid floating point issues
                // Use diesel for remaining load
                dieselGen = Math.min(remainingLoad, dieselCapacity);
                totalDieselEnergy += dieselGen;
                if (dieselGen > 0) dieselRuntime += 1;
            }
        } else {
            // Excess renewable energy - charge BESS
            const excessEnergy = -netLoad;
            const maxBESSCharge = Math.min(bessCapacity - bessSOC, bessCapacity * 0.25); // Max 0.25C charge rate, limited by available space
            bessCharge = Math.min(excessEnergy, maxBESSCharge / bessEff); // Adjust for efficiency losses

            bessSOC += bessCharge * bessEff; // Energy stored after losses
            totalBESSCycles += bessCharge / (bessCapacity * 2); // Charge contributes to cycles
        }

        // Store BESS and diesel data for chart (show actual energy to/from grid, not internal battery energy)
        hourlyBESSDischarge.push(bessDischarge * bessEff); // Energy delivered to load
        hourlyBESSCharge.push(-bessCharge); // Energy consumed from renewables (negative for chart)
        hourlyDiesel.push(dieselGen);

        // Keep BESS SOC within bounds
        bessSOC = Math.max(0, Math.min(bessCapacity, bessSOC));
    }

    // Annualize results (365 days)
    const annualDieselEnergy = totalDieselEnergy * 365; // kWh/year
    const annualRenewableEnergy = totalRenewableEnergy * 365; // kWh/year
    const annualLoad = totalLoad * 365; // kWh/year
    const annualDieselRuntime = dieselRuntime * 365; // hours/year
    const annualBESSCycles = totalBESSCycles * 365;

    const renewableFraction = annualLoad > 0 ? ((annualRenewableEnergy - (annualDieselEnergy > 0 ? 0 : 0)) / annualLoad) * 100 : 0;

    // === COST CALCULATION ===
    const projectLifetime = 25; // years
    const discountRate = 0.08;

    // Total CAPEX
    const totalCapex = (pvCapacity * pvCapex) +
                       (windCapacity * windCapex) +
                       (bessCapacity * bessCapex) +
                       (dieselCapacity * dieselCapex);

    // Annual OPEX
    const pvOMCost = pvCapacity * pvCapex * pvOpex;
    const windOMCost = windCapacity * windCapex * windOpex;
    const bessOMCost = bessCapacity * bessCapex * bessOpex;

    // Diesel fuel cost (kWh to liters conversion)
    const annualDieselFuelCost = (annualDieselEnergy / dieselEff) * dieselFuelPrice;

    const annualOpex = pvOMCost + windOMCost + bessOMCost + annualDieselFuelCost;

    // NPV of OPEX (Present Value of annuity)
    const PV_Factor = (1 - Math.pow(1 + discountRate, -projectLifetime)) / discountRate;
    const opexNPV = annualOpex * PV_Factor;

    // Total System Cost (NPV)
    const totalSystemCost = totalCapex + opexNPV;

    // === UPDATE DISPLAY ===
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

    document.getElementById('total-cost').innerText = formatter.format(totalSystemCost);
    document.getElementById('renewable-fraction-mg').innerText = renewableFraction.toFixed(1) + "%";
    document.getElementById('diesel-runtime').innerText = Math.round(annualDieselRuntime).toLocaleString() + " hrs/yr";
    document.getElementById('bess-cycles').innerText = Math.round(annualBESSCycles) + " cycles/yr";

    // === UPDATE CHART ===
    const ctx = document.getElementById('dispatchChart');
    if (ctx) {
        // Destroy previous chart instance if it exists
        if (microgridChart) {
            microgridChart.destroy();
        }

        // Create new chart
        microgridChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00',
                         '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
                         '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'],
                datasets: [
                    {
                        label: 'Load',
                        data: hourlyLoad,
                        backgroundColor: 'rgba(15, 23, 42, 0.8)',
                        borderColor: 'rgba(15, 23, 42, 1)',
                        borderWidth: 1,
                        type: 'line',
                        fill: false,
                        tension: 0.4,
                        pointRadius: 3,
                        pointBackgroundColor: 'rgba(15, 23, 42, 1)',
                        order: 0
                    },
                    {
                        label: 'PV Generation',
                        data: hourlyPV,
                        backgroundColor: 'rgba(251, 191, 36, 0.7)',
                        borderColor: 'rgba(251, 191, 36, 1)',
                        borderWidth: 1,
                        stack: 'generation'
                    },
                    {
                        label: 'Wind Generation',
                        data: hourlyWind,
                        backgroundColor: 'rgba(96, 165, 250, 0.7)',
                        borderColor: 'rgba(96, 165, 250, 1)',
                        borderWidth: 1,
                        stack: 'generation'
                    },
                    {
                        label: 'BESS Discharge',
                        data: hourlyBESSDischarge,
                        backgroundColor: 'rgba(118, 255, 3, 0.7)',
                        borderColor: 'rgba(118, 255, 3, 1)',
                        borderWidth: 1,
                        stack: 'generation'
                    },
                    {
                        label: 'Diesel',
                        data: hourlyDiesel,
                        backgroundColor: 'rgba(239, 68, 68, 0.7)',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        borderWidth: 1,
                        stack: 'generation'
                    },
                    {
                        label: 'BESS Charge',
                        data: hourlyBESSCharge,
                        backgroundColor: 'rgba(0, 136, 204, 0.7)',
                        borderColor: 'rgba(0, 136, 204, 1)',
                        borderWidth: 1,
                        stack: 'charge'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2.5,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 10,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += Math.abs(context.parsed.y).toFixed(1) + ' kW';
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: { size: 10 }
                        }
                    },
                    y: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Power (kW)',
                            font: { size: 12, weight: 'bold' }
                        },
                        ticks: {
                            callback: function(value) {
                                return Math.abs(value) + ' kW';
                            }
                        }
                    }
                }
            }
        });
    }
}