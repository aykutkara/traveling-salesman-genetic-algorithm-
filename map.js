// Haritayı oluşturma
var map = L.map("harita").setView(
    [39.65382282725965, 27.897258818332517],
    8
);
// Harita arkaplanı için OpenStreetMap verilerini kullanıyorum
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright%22%3EOpenStreetMap</a> contributors',
}).addTo(map);

//Sınırları haritada görüntülemek için kullandığım fonksiyon
//bu url i dosyamdaki boundaries.geojson dosyasını github hesabımdan dönüştürerek alıyorum.
function rangeMap() {
    fetch(
        "https://gist.githubusercontent.com/aykutkara/ec7e17d1425e489345ffdbdd28554717/raw/ef039150c68e420b0415d016e2e1111aba840e9f/boundaries.json"
    )
        .then((response) => response.json())
        .then((data) => {
            var geojson = L.geoJSON(data, {
                style: function (feature) {
                    return { color: "#6495ED", weight: 3 };
                },
            }).addTo(map);
        });
}
// Harita için sınırları belirliyorum
var southWest = L.latLng(39.5, 27.5),
    northEast = L.latLng(40.5, 28.5),
    bounds = L.latLngBounds(southWest, northEast);

map.fitBounds(bounds);
map.setZoom(9);

rangeMap();

// Haritaya tıklandıkça 20 taneye kadar nokta seçebilmek için işlemler 
var markers = [];
map.on("click", async function (e) {
    if (markers.length < 20) {
        if (markers.length == 0) {
            var location = L.circleMarker(e.latlng, {
                color: "blue",
                fillColor: "blue",
                fillOpacity: 0.8,
                radius: 14,
            }).addTo(map);
            location.bindTooltip("<p>" + (markers.length + 1) + "</p>", {
                permanent: true,
                direction: "center",
                offset: [0, 0],
                className: "location",
            });
        } else {
            var location = L.circleMarker(e.latlng, {
                color: "red",
                fillColor: "red",
                fillOpacity: 0.8,
                radius: 14,
            }).addTo(map);
            location.bindTooltip("<p>" + (markers.length + 1) + "</p>", {
                permanent: true,
                direction: "center",
                offset: [0, 0],
                className: "location",

            });
        }
        markers.push(e.latlng);
        document.getElementById("sayacSpan").innerHTML = markers.length;
    } else {
        document.getElementById("alert-modal-text").innerHTML =
            "En fazla 20 nokta seçebilirsiniz.";
        document.getElementById("alert-modal").style.display = "flex";
        document
            .getElementById("alert-modal-close")
            .addEventListener("click", function () {
                document.getElementById("alert-modal").style.display = "none";
            });
    }
});
// Seçilen noktalar arasındaki mesafeleri ve rotaları hesaplattığım fonksiyon
async function getDistanceAndRoute(markers) {
    const coordinates = [];
    const distance = [];

    // Bu döngüler ile uzaklık matrisi ve rotayı hesaplatıyorum.

    for (let i in markers) {
        distance.push(Array.from({ length: markers.length }, () => 0));
        coordinates.push([]);
    }

    const informations = [];
    for (let i = 0; i < markers.length; i++) {
        for (let j = 0; j < markers.length; j++) {
            if (i == j) continue;

            informations.push({
                start: [markers[i].lng, markers[i].lat],
                end: [markers[j].lng, markers[j].lat],
                index: [i, j],
            });
        }
    }
    // Aynı anda tüm bilgiler için mesafe ve rota hesaplama isteği gönderiyorum
    await Promise.all(
        informations.map(async (info) => {
            //OpenStreetMap API'sini kullanarak rota ve mesafe bilgisi alıyorum
            const url = `http://routing.openstreetmap.de/routed-car/route/v1/driving/${info.start[0]},${info.start[1]};${info.end[0]},${info.end[1]}?overview=false&alternatives=true&steps=true&geometries=geojson`;
            const response = await fetch(url);
            const getData = await response.json();
            //En kısa rotayı alma
            const shortRoute = getData.routes.sort(
                (a, b) => a.distance - b.distance
            )[0];
            // Rota adımlarını alıyorum
            const steps = shortRoute.legs[0].steps;

            const coords = [];

            steps.forEach((step) => {
                coords.push(...step.geometry.coordinates);
            });
            // Mesafeyi ve rota koordinatlarını kaydediyorum
            distance[info.index[0]][info.index[1]] = shortRoute.distance;
            coordinates[info.index[0]][info.index[1]] = coords;
        })
    );

    return [distance, coordinates];
}
// Bu fonksiyon ile verilen  rota ve mutasyon oranı girdileri alıyorum
function mutation(route, mutationRate) {
    // Rotayı kopyalıyorum ve daha sonra rota boyunca döngüye girdiriyorum.
    const newRoute = [...route];
    for (let i = 0; i < route.length; i++) {
        // Her döngü için, eğer rastgele üreteilen sayı mutasyon oranından daha küçükse ve i 0'dan farklıysa, 
        //rota içinde rastgele bir indekse atıyorum ve o indeksle i indeksi yer değiştiriyorum.
        if (Math.random() < mutationRate && i != 0) {
            const randomValue = Math.floor(Math.random() * route.length);
            const temporary = newRoute[i];
            if (randomValue == 0) {
                continue;
            }
            newRoute[i] = newRoute[randomValue];
            newRoute[randomValue] = temporary;
        }
    }
    //Değiştirilmiş rotayı döndürüyorum.
    return newRoute;
}
//Bu fonksiyon ile çaprazlama işlemini yapıyorum.
function crossover(route1, route2) {
    // Rastgele bir indeks üretiyorum
    const randomValue = Math.floor(Math.random() * route1.length);
    // Yeni bir rota oluştur
    const newRoute = [];
    if (randomValue == 0) {
        return route1;
    }
    // Route1 içindeki elemanların yeni rotaya ekliyorum
    for (let i = 0; i < randomValue; i++) {
        newRoute[i] = route1[i];
    }
    // Eğer daha önce eklenmediyse, route2 içindeki elemanları yeni rotaya ekliyorum

    for (let i = 0; i < route2.length; i++) {
        if (!newRoute.includes(route2[i])) {
            newRoute.push(route2[i]);
        }
    }
    // Yeni rotayı döndürüyorum
    return newRoute;
}
//Bu fonksiyon ile rotalarımı oluşturuyorum.
async function createRoute() {
    //ekranımda kullancının gireceği inputlar boş mu diye kontrol ediyorum.
    //Boş ise uyarı veriyorum.
    var inputs = document.querySelectorAll("input");
    var isValid = true;
    for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].value === "") {
            isValid = false;
            break;
        }
    }
    if (!isValid) {
        document.getElementById("alert-modal-text").innerHTML =
            "Lütfen tüm alanları doldurunuz.";
        document.getElementById("alert-modal").style.display = "flex";
        document
            .getElementById("alert-modal-close")
            .addEventListener("click", function () {
                document.getElementById("alert-modal").style.display = "none";
            });
        return;
    }
    //burada kullanıcı hesapla butonuna her basıldığında silinmesi gereken tabloları ve verileri siliyorum.
    document.getElementById("coordinatTable").innerHTML = "";
    document.getElementById("distanceTable").innerHTML = "";
    document.getElementById("sortingP").innerHTML = "";

    //Burada kullanıcı en az 2 nokta seçmediyse uyarı veriyorum.
    if (markers.length < 2) {
        document.getElementById("alert-modal-text").innerHTML =
            "En az 2 nokta seçmelisiniz.";
        document.getElementById("alert-modal").style.display = "flex";
        document
            .getElementById("alert-modal-close")
            .addEventListener("click", function () {
                document.getElementById("alert-modal").style.display = "none";
            });
        return;
    }
    // Konumlar arası mesafeler ve rotaları elde ediyorum
    const [distance, coordinates] = await getDistanceAndRoute(markers);
    let population = randomRoute(markers.length, 50);

    // Kullanıcıdan gerekli girdileri alıyorum
    const mutationRate = document.getElementById("mutationNumber").value;;
    const crossOverRate = document.getElementById("crossOverNumber").value;;
    const iterationNumber = document.getElementById("iterationNumber").value;;

    // Turnuva büyüklüğü
    const tournamentSize = 5;

    // İterasyon sayısı kadar döngüye girdiriyorum
    for (let i = 0; i < iterationNumber; i++) {
        // Yeni popülasyon dizisi oluşturuyorum
        const newPopulation = [];
        for (let j = 0; j < population.length; j++) {
            // Turnuva seçiminden ilk ebeveyni seçiyorum
            const parent1 = tournamentSelection(
                population,
                tournamentSize,
                distance
            );
            // Turnuva seçiminden ikinci ebeveyni seçiyorum
            const parent2 = tournamentSelection(
                population,
                tournamentSize,
                distance
            );
            // Rastgele çaprazlama oranı belirliyorum    
            const randomCross = Math.random();
            // Eğer rastgele çaprazlama oranı çaprazlama oranından küçükse, ilk ebeveyni mutasyona uğratıyorum
            if (randomCross < crossOverRate) {
                newPopulation.push(mutation(parent1, mutationRate));
            }
            // Değilse  ebeveynler arasından çocuğu oluşturuyorum ve mutasyona uğratıyorum
            else {
                const child = crossover(parent1, parent2);
                const mutatedChild = mutation(child, mutationRate);
                newPopulation.push(mutatedChild);
            }
            // Eğer yeni nüfusun ilk elemanının uzunluğu mesafelerin uzunluğu + 1 den küçükse, ilk elemanı sonuna ekliyorum
            if (newPopulation[0].length <= distance.length + 1) {
                newPopulation[j].push(newPopulation[j][0]);
            }
        }
        // Nüfusu yeni nüfus ile güncelleştiriyorum
        population = newPopulation;
    }
    //Nüfustaki en kısa rotayı buluyorum
    const shortest = population.sort(
        (a, b) =>
            calculateDistance(a, distance) - calculateDistance(b, distance)
    )[0];
    // rota için dizi oluşturuyorum
    const path = [];
    for (let i = 0; i < shortest.length - 1; i++) {
        if (shortest[i] == shortest[i + 1]) {
            continue;
        }
        path.push(...coordinates[shortest[i] - 1][shortest[i + 1] - 1]);
    }
    for (let i = 0; i < path.length - 1; i++) {
        const [x1, y1] = path[i];
        const [x2, y2] = path[i + 1];

        L.polyline(
            [
                [y1, x1],
                [y2, x2],
            ],
            { color: "black", weight: 1 }
        ).addTo(map);
    }
    // En kısa rotayı ekrana yazdırıyorum
    for (let i = 0; i < shortest.length; i++) {
        if (i == shortest.length - 1) {
            document.getElementById("sortingP").innerHTML += shortest[i];
            break;
        }
        document.getElementById("sortingP").innerHTML +=
            " " + shortest[i] + " -";
    }
    //Burada indirme butonuna tıklandığında
    // kullanıcının tıkladığı konumların koordinat tablosunu csv olarak indirmesini sağlıyorum
    const downloadCoordinats = document.getElementById("markersCSV");
    downloadCoordinats.addEventListener("click", () => {
        downloadCsv("coordinatTable.csv", json2csv.parse(markers, { header: true }));
    });
    //Burada indirme butonuna tıklandığında
    // uzaklık tablosunun csv olarak indirmesini sağlıyorum
    const downloadDistance = document.getElementById("distanceCSV");
    downloadDistance.addEventListener("click", () => {
        downloadCsv("distanceTable.csv", json2csv.parse(distance, { header: false }));
    });

    //Burada koordinat tablosunu oluşturduğum fonksiyonu çağırıyorum
    createCoordinatesTable();
    //Burada uzaklık tablosunu oluşturduğum fonksiyonu çağırıyorum
    createDistanceTable(distance);
}
//Bu fonksiyonu csv dosyalarını indirmemiz için oluşturdum
function downloadCsv(filename, csvData) {
    const element = document.createElement("a");

    element.setAttribute("href", `data:text/csv;charset=utf-8,${csvData}`);
    element.setAttribute("download", filename);
    element.style.display = "none";

    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}
//Bu fonksiyonu kullanıcının tıkladığı koordinatları tablo halinde ekrana yazdırmak için oluşturdum.
function createCoordinatesTable() {
    //Konum sayım kadar döngüye girdiriyorum ve her döngüde o anki konumun enlem ve boylamını alıp tabloya yazdırıyorum.
    for (tableLength = 0; tableLength < markers.length; tableLength++) {
        var item = document.createElement("tr");
        item.innerHTML =
            "<td class='tableNo'>" +
            (tableLength + 1) +
            "</td>" +
            "<td class='tableTd' id='enlem" +
            (tableLength + 1) +
            "'>" +
            markers[tableLength].lat +
            "</td>" +
            "<tdclass='tableTd' id='boylam" +
            (tableLength + 1) +
            "'>" +
            markers[tableLength].lng +
            "</td>";
        //burada tabloya ekleme işlemini yapıyorum.
        document.getElementById("coordinatTable").appendChild(item);
    }
}
//Bu fonksiyonu kullanıcının tıkladığı koordinatlara göre hesapladığım uzaklık değerlerini matris halinde ekrana yazdırmak için oluşturdum.
function createDistanceTable(dist) {
    //burada matrisin ilk satırında indekslerini yazdırıyorum.
    var line1 = document.createElement("tr");
    for (i = 0; i < dist.length; i++) {
        if (i == 0) {
            line1.innerHTML = "<td class='distanceLine1'></td>";
        }
        line1.innerHTML += "<td class='distanceTd'>" + (i + 1) + "</td>";
        document.getElementById("distanceTable").appendChild(line1);
    }
    //burada matrisin ilk sütununda indekslerini yazdırıyorum ve matrisin geri kalan kısmını yazdırıyorum.
    for (i = 0; i < dist.length + 1; i++) {
        var line = document.createElement("tr");
        for (j = 0; j < dist.length; j++) {
            if (j == 0) {
                line.innerHTML = "<td class='distanceRow1'>" + (i + 1) + "</td>";
            }
            line.innerHTML += "<td class='distanceTd'>" + dist[i][j] + "</td>";
            document.getElementById("distanceTable").appendChild(line);
        }
    }
    //Aşağıda yazdığım kodlar ile matris tablosunun boyutunu 
    //kullanıcı eliyle sürükleyip bırakarak değiştirmesini sağlıyorum.
    document
        .getElementById("distanceDiv")
        .addEventListener("mousedown", mouseDown);
    var div;

    function mouseDown() {
        div = document.getElementById("distanceDiv");
        window.addEventListener("mousemove", divResize);
        window.addEventListener("mouseup", stopResize);
    }

    function divResize(e) {
        div.style.width = e.clientX - div.offsetLeft + "px";
        div.style.height = e.clientY - div.offsetTop + "px";
    }

    function stopResize() {
        window.removeEventListener("mousemove", divResize);
    }
}
//Bu fonksiyon ile silme butonunasıldığında silinmesi gereken yerlerdeki verileri siliyorum.
function deleteRoute() {
    document.getElementById("coordinatTable").innerHTML = "";
    document.getElementById("distanceTable").innerHTML = "";
    document.getElementById("sayacSpan").innerHTML = "0";
    document.getElementById("distanceDiv").style.width = "13rem";
    document.getElementById("distanceDiv").style.height = "13rem";
    document.getElementById("sortingP").innerHTML = "";
    map.eachLayer(function (layer) {
        if (layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
        if (layer instanceof L.CircleMarker) {
            map.removeLayer(layer);
        }
    });
    rangeMap();
    markers = [];
    var inputs = document.querySelectorAll("input");
    for (var i = 0; i < inputs.length; i++) {
        inputs[i].value = "";
    }
}
//Bu fonksiyon ile random rotalar oluşturuyorum.
function randomRoute(coordinatCount, count) {
    // Rastgele rotaları tutacağım dizi
    const randomRoutes = [];
    for (let i = 0; i < count; i++) {
        const items = Array.from({ length: coordinatCount }, (_, i) => i + 1);
        // Sayıları rastgele sıralıyorum
        for (let j = 1; j < items.length; j++) {
            const randomValue = Math.floor(Math.random() * items.length);
            if (randomValue == 0) continue;
            const temporary = items[j];
            items[j] = items[randomValue];
            items[randomValue] = temporary;
        }
        // Rastgele sıralanmış sayıları diziye ekliyorum
        randomRoutes.push(items);
    }
    // Rastgele rotaları döndürüyorum
    return randomRoutes;
}
//Bu fonksiyon ile uzaklıkların toplamlarını hesaplıyorum.
function calculateDistance(route, distance) {
    // Toplam mesafeyi tuttuğum değişken
    let totalDistance = 0;
    for (let i = 0; i < route.length - 1; i++) {
        // İki nokta arası mesafeyi toplayıp totalDistance değişkenine ekliyorum
        totalDistance += distance[route[i] - 1][route[i + 1] - 1];
    }
    // Toplam mesafeyi döndürüyorum
    return totalDistance;
}
//Turnuva seçimine göre en iyi rota seçimi yapıyor.
function tournamentSelection(population, tournamentSize, distance) {
    // Turnuva için oluşturduğum dizi
    const tournament = [];
    for (let i = 0; i < tournamentSize; i++) {
        const randomValue = Math.floor(Math.random() * population.length);
        if (randomValue == 0) return population[0];
        tournament.push(population[randomValue]);
    }
    // Turnuvayı mesafelerine göre sıralayıp ve en iyi olanını döndürüyorum
    return tournament.sort(
        (a, b) =>
            calculateDistance(a, distance) - calculateDistance(b, distance)
    )[0];
}
