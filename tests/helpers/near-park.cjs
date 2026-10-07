// Existing isolated UI tests represent a visitor near the parks.
module.exports=ctx=>{ctx.tooFarFromPark??=()=>false;ctx.navigationBlocked??=()=>false;ctx.syncCatalogDistanceMode??=()=>{};ctx.updateParkProximity??=()=>{};ctx.nearbySortPreference??=null;ctx.facilityVisible??=()=>true;ctx.restaurantRating??=()=>null;return ctx;};
